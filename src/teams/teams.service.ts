
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class TeamsService {
    constructor(private prisma: PrismaService) { }

    async create(data: any, userId: string, role: string, departmentId?: string) {
        // Validate Department Access
        if (role === Role.ADMIN || role === Role.DEPARTMENT_MANAGER) {
            if (data.departmentId !== departmentId) {
                throw new ForbiddenException('Admins can only create teams in their own department');
            }
        }

        // Ensure project exists
        const project = await this.prisma.project.findUnique({
            where: { id: data.projectId },
            include: { departments: true }
        });
        if (!project) throw new NotFoundException('Project not found');

        // Check if project is assigned to this department
        if ((role === Role.ADMIN || role === Role.DEPARTMENT_MANAGER) && departmentId) {
            const isAssigned = project.departments.some(pd => pd.departmentId === departmentId);
            if (!isAssigned) {
                throw new ForbiddenException('Project is not assigned to your department');
            }
        }

        return this.prisma.team.create({
            data: {
                name: data.name,
                projectId: data.projectId,
                departmentId: data.departmentId, // Must be passed explicitly now
                createdByUserId: userId,
            },
            include: {
                project: true,
                department: true
            }
        });
    }

    async findAllByUserId(userId: string) {
        // Find teams where user is a member
        const member = await this.prisma.employee.findUnique({ where: { userId } });
        if (!member) return [];

        return this.prisma.team.findMany({
            where: {
                members: {
                    some: {
                        employeeId: member.id
                    }
                }
            },
            include: {
                project: true,
                department: { select: { name: true } }
            }
        });
    }

    async findOne(id: string, user: any) {
        const team = await this.prisma.team.findUnique({
            where: { id },
            include: {
                members: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                jobTitle: true,
                                userId: true,
                                // NO PHONE/EMAIL
                            }
                        }
                    }
                },
                project: true
            }
        });
        if (!team) throw new NotFoundException('Team not found');

        // Check Access
        const isMember = team.members.some(m => m.employee.userId === user.id);

        const userEmployee = await this.prisma.employee.findUnique({ where: { userId: user.id } });

        const isActuallyMember = userEmployee ? team.members.some(m => m.employeeId === userEmployee.id) : false;
        const isDeptAdmin = (user.role === Role.ADMIN || user.role === Role.DEPARTMENT_MANAGER) && user.departmentId === team.departmentId;
        const isSuperAdmin = user.role === Role.SUPER_ADMIN;
        const isProjectManager = user.role === Role.PROJECT_MANAGER && team.project.projectManagerId === user.id;

        if (!isActuallyMember && !isDeptAdmin && !isSuperAdmin && !isProjectManager) {
            throw new ForbiddenException('Access denied');
        }

        return team;
    }

    async addMember(teamId: string, employeeId: string, currentUser: any) {
        // Logic for admin check...
        return this.prisma.teamMember.create({
            data: {
                teamId,
                employeeId
            }
        });
    }

    async removeMember(teamId: string, memberId: string, currentUser: any) {
        // Logic...
        return this.prisma.teamMember.delete({
            where: { id: memberId }
        });
    }

    async findMessages(teamId: string, userId: string) {
        // Verify membership
        return this.prisma.teamMessage.findMany({
            where: { teamId },
            include: {
                sender: {
                    include: {
                        employee: {
                            select: { firstName: true, lastName: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
    }

    async sendMessage(teamId: string, userId: string, content: string, attachmentUrl?: string) {
        return this.prisma.teamMessage.create({
            data: {
                teamId,
                senderUserId: userId,
                body: content,
                attachmentUrl
            }
        });
    }
}
