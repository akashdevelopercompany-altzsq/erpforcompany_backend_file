import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { Role, TicketStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TicketsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async create(dto: CreateTicketDto, userId: string, attachmentUrl?: string) {
        const employee = await this.prisma.employee.findUnique({ where: { userId }, include: { user: true } });
        if (!employee) throw new NotFoundException('Employee profile not found');

        const ticket = await this.prisma.supportTicket.create({
            data: {
                employeeId: employee.id,
                subject: dto.subject,
                description: dto.description,
                category: dto.category,
                priority: dto.priority || 'MEDIUM',
                attachmentUrl,
                status: TicketStatus.OPEN,
            }
        });

        // --- Notification Logic ---
        const recipients = new Set<string>();

        // 1. Always notify Super Admins
        const superAdmins = await this.prisma.user.findMany({ where: { role: Role.SUPER_ADMIN } });
        superAdmins.forEach(admin => recipients.add(admin.id));

        // 2. Routing Logic
        if (dto.category === 'WELLNESS') {
            // Route to Wellness Department
            const wellnessDept = await this.prisma.department.findFirst({
                where: { name: { contains: 'Wellness', mode: 'insensitive' } }
            });
            if (wellnessDept) {
                const wellnessAdmins = await this.getAdminsForDepartment(wellnessDept.id);
                wellnessAdmins.forEach(admin => recipients.add(admin.id));
            }
        } else {
            // IT Support / HR / Facility
            // A. Notify Employee's Department Admin
            if (employee.user.departmentId) {
                const employeeDeptAdmins = await this.getAdminsForDepartment(employee.user.departmentId);
                employeeDeptAdmins.forEach(admin => recipients.add(admin.id));
            }

            // B. Notify Target Department Admin
            let targetDeptName = '';
            if (dto.category === 'IT_SUPPORT') targetDeptName = 'IT';
            else if (dto.category === 'HR_QUERY') targetDeptName = 'HR';
            else if (dto.category === 'FACILITY') targetDeptName = 'Facility';

            if (targetDeptName) {
                const targetDept = await this.prisma.department.findFirst({
                    where: { name: { contains: targetDeptName, mode: 'insensitive' } }
                });
                if (targetDept) {
                    const targetAdmins = await this.getAdminsForDepartment(targetDept.id);
                    targetAdmins.forEach(admin => recipients.add(admin.id));
                }
            }
        }

        const employeeName = `${employee.firstName} ${employee.lastName}`;
        await this.notificationsService.createAndBroadcast(
            Array.from(recipients),
            'TICKET_CREATE',
            ticket.id,
            {
                title: dto.category === 'WELLNESS' ? 'New Wellness Session' : 'New Support Ticket',
                message: `${employeeName} requested: ${dto.subject}`,
                employeeName,
                category: dto.category
            }
        );

        return ticket;
    }

    async submitReport(ticketId: string, content: string, isCritical: boolean, userId: string) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId }, include: { employee: { include: { user: true } } } });
        if (!ticket) throw new NotFoundException('Ticket not found');

        // Update Ticket
        const updatedTicket = await this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                resolution: content,
                status: TicketStatus.RESOLVED,
                resolvedAt: new Date(),
                resolvedByUserId: userId
            }
        });

        // Notifications
        const recipients = new Set<string>();

        // 1. Notify Employee's Dept Admin
        if (ticket.employee.user.departmentId) {
            const deptAdmins = await this.getAdminsForDepartment(ticket.employee.user.departmentId);
            deptAdmins.forEach(a => recipients.add(a.id));
        }

        // 2. If Critical, Notify Super Admin
        if (isCritical) {
            const superAdmins = await this.prisma.user.findMany({ where: { role: Role.SUPER_ADMIN } });
            superAdmins.forEach(a => recipients.add(a.id));
        }

        // 3. Notify Employee that report is ready
        recipients.add(ticket.employee.userId);

        await this.notificationsService.createAndBroadcast(
            Array.from(recipients),
            'TICKET_REPLY',
            ticket.id,
            {
                title: isCritical ? 'CRITICAL: Wellness Report Flagged' : 'Wellness Session Report',
                message: isCritical
                    ? `Critical concern flagged for ${ticket.employee.firstName} ${ticket.employee.lastName}`
                    : `Report submitted for session: ${ticket.subject}`,
                isCritical
            }
        );

        return updatedTicket;
    }

    async remove(id: string, user: any) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { employee: true } });
        if (!ticket) throw new NotFoundException('Ticket not found');

        // RBAC: Only Creator (Employee) or Admin/SuperAdmin can delete
        if (user.role === Role.EMPLOYEE) {
            if (ticket.employee.userId !== user.id) throw new ForbiddenException('Access denied');
        } else if (user.role === Role.ADMIN) {
            const employeeUser = await this.prisma.user.findUnique({ where: { id: ticket.employee.userId } });
            if (employeeUser?.departmentId !== user.departmentId) throw new ForbiddenException('Access denied');
        }

        return this.prisma.supportTicket.delete({ where: { id } });
    }

    async findAll(user: any) {
        if (user.role === Role.EMPLOYEE) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return [];
            return this.prisma.supportTicket.findMany({
                where: { employeeId: employee.id },
                orderBy: { createdAt: 'desc' }
            });
        } else if (user.role === Role.ADMIN) {
            const adminDept = await this.prisma.department.findUnique({ where: { id: user.departmentId } });
            const isWellnessAdmin = adminDept?.name.toLowerCase().includes('wellness');

            if (isWellnessAdmin) {
                return this.prisma.supportTicket.findMany({
                    where: { category: 'WELLNESS' },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        employee: {
                            include: {
                                user: {
                                    include: {
                                        department: true
                                    }
                                }
                            }
                        }
                    }
                });
            }

            return this.prisma.supportTicket.findMany({
                where: {
                    employee: {
                        user: {
                            departmentId: user.departmentId
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: {
                        include: {
                            user: {
                                include: {
                                    department: true
                                }
                            }
                        }
                    }
                }
            });
        } else if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.supportTicket.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: {
                        include: {
                            user: {
                                include: {
                                    department: true
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    async updateStatus(id: string, dto: UpdateTicketStatusDto, user: any) {
        const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { employee: true } });
        if (!ticket) throw new NotFoundException('Ticket not found');

        // Check RBAC
        if (user.role === Role.ADMIN) {
            const employeeUser = await this.prisma.user.findUnique({ where: { id: ticket.employee.userId } });

            const adminDept = await this.prisma.department.findUnique({ where: { id: user.departmentId } });
            const isWellnessTicket = ticket.category === 'WELLNESS';
            // Safe check for adminDept existence to avoid runtime errors
            const isWellnessAdmin = adminDept?.name ? adminDept.name.toLowerCase().includes('wellness') : false;

            if (isWellnessTicket && isWellnessAdmin) {
                // Allow Wellness Admin to manage Wellness tickets regardless of employee dept
            } else {
                if (employeeUser?.departmentId !== user.departmentId) throw new ForbiddenException('Access denied');
            }
        }

        const updatedTicket = await this.prisma.supportTicket.update({
            where: { id },
            data: {
                status: dto.status,
                resolution: dto.resolution,
                resolvedAt: dto.status === TicketStatus.RESOLVED ? new Date() : null,
                resolvedByUserId: user.id,
            },
            include: { employee: true }
        });

        if (user.role !== Role.EMPLOYEE) {
            await this.notificationsService.createAndBroadcast(
                [updatedTicket.employee.userId],
                'TICKET_REPLY',
                updatedTicket.id,
                {
                    title: 'Ticket Updated',
                    message: `Your ticket "${updatedTicket.subject}" status is now ${dto.status}`,
                    status: dto.status
                }
            );
        }

        return updatedTicket;
    }

    private async getAdminsForDepartment(departmentId: string) {
        return this.prisma.user.findMany({
            where: {
                role: Role.ADMIN,
                departmentId
            }
        });
    }

    async getLegalStats() {
        const legalTickets = await this.prisma.supportTicket.findMany({
            where: { category: 'LEGAL' },
            include: {
                employee: {
                    include: {
                        user: {
                            include: {
                                department: true
                            }
                        }
                    }
                }
            }
        });

        const total = legalTickets.length;
        const open = legalTickets.filter(t => t.status === TicketStatus.OPEN).length;
        const inProgress = legalTickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
        const resolved = legalTickets.filter(t => t.status === TicketStatus.RESOLVED).length;

        return {
            total,
            open,
            inProgress,
            resolved,
            tickets: legalTickets
        };
    }

    async getLegalReports() {
        return this.prisma.supportTicket.findMany({
            where: { category: 'LEGAL' },
            orderBy: { createdAt: 'desc' },
            include: {
                employee: {
                    include: {
                        user: {
                            include: {
                                department: true
                            }
                        }
                    }
                },
                resolvedBy: {
                    select: {
                        email: true,
                        role: true
                    }
                }
            }
        });
    }
}
