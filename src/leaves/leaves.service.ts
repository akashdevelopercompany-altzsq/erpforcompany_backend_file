import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { Role, Gender, LeaveStatus } from '@prisma/client';

import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class LeavesService {
    constructor(
        private prisma: PrismaService,
        private tokensService: TokensService,
    ) { }

    async requestLeave(userId: string, createLeaveDto: CreateLeaveDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
        if (!user || !user.employee) throw new NotFoundException('Employee profile not found');

        // Calculate days
        const start = new Date(createLeaveDto.startDate);
        const end = new Date(createLeaveDto.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

        // Menstruation check
        if (createLeaveDto.type === 'MENSTRUATION') {
            if (user.employee.gender !== Gender.FEMALE) {
                throw new ForbiddenException('Menstruation leave is only available for female employees');
            }
            // Check limit (2 days/month)
            // This is complex to check per month, for now let's check token balance (24/year)
            // But spec says "max 2 days/month using tokens".
            // Let's rely on token balance for simplicity first, or check previous leaves this month.
            // For now, check token balance.
            const hasBalance = await this.tokensService.checkBalance(user.employee.id, createLeaveDto.type, diffDays);
            if (!hasBalance) throw new ForbiddenException('Insufficient leave balance');
        } else {
            // Check balance for other types (EXCEPT WORK_FROM_HOME)
            if (createLeaveDto.type !== 'WORK_FROM_HOME') {
                const hasBalance = await this.tokensService.checkBalance(user.employee.id, createLeaveDto.type, diffDays);
                if (!hasBalance) throw new ForbiddenException('Insufficient leave balance');
            }
        }

        if (!user.departmentId) {
            throw new NotFoundException('User does not belong to a department');
        }

        // Determine approval status
        let status: LeaveStatus = LeaveStatus.PENDING;
        let isAutoApproved = false;

        // 1. LOP and PERMISSION are always PENDING (Manual Approval)
        if (createLeaveDto.type === 'LOSS_OF_PAY' || createLeaveDto.type === 'PERMISSION') {
            status = LeaveStatus.PENDING;
        }
        // 2. SICK Leave
        else if (createLeaveDto.type === 'SICK') {
            // Auto-Approve regardless of duration (as long as tokens exist)
            // Note: > 2 days technically requires Medical Report (handled offline/via warning)
            status = LeaveStatus.APPROVED;
            isAutoApproved = true;
        }
        // 3. Status check for other types (CASUAL, MENSTRUATION, WORK_FROM_HOME) - Check Monthly Limit
        else {
            let monthlyLimit = 3;
            if (createLeaveDto.type === 'MENSTRUATION') monthlyLimit = 2;
            if (createLeaveDto.type === 'WORK_FROM_HOME') monthlyLimit = 24; // Effectively restricted by total tokens, but let's say no specific monthly limit other than balance

            // For Work From Home
            if (createLeaveDto.type === 'WORK_FROM_HOME') {
                // WFH now requires manual approval for all durations as per Admin request
                status = LeaveStatus.PENDING;
                isAutoApproved = false;
            } else {
                // Existing logic for Casual/Menstruation
                // Check usage for the month of the requested start date
                const usage = await this.getMonthlyLeaveUsage(user.employee.id, createLeaveDto.type, start);

                if ((usage + diffDays) <= monthlyLimit) {
                    status = LeaveStatus.APPROVED;
                    isAutoApproved = true;
                } else {
                    status = LeaveStatus.PENDING; // Exceeds monthly limit, requires manual approval
                }
            }
        }

        const leave = await this.prisma.leave.create({
            data: {
                employeeId: user.employee.id,
                departmentId: user.departmentId,
                type: createLeaveDto.type,
                reason: createLeaveDto.reason,
                startDate: createLeaveDto.startDate,
                endDate: createLeaveDto.endDate,
                status: status,
                isAutoApproved: isAutoApproved,
            }
        });

        // If auto-approved, deduct tokens immediately (EXCEPT for WFH)
        if (leave.status === LeaveStatus.APPROVED) {
            if (leave.type !== 'WORK_FROM_HOME') {
                await this.tokensService.deductTokens(user.employee.id, leave.type, diffDays);
            }

            // Notify Employee
            await this.prisma.notification.create({
                data: {
                    userId: user.id,
                    title: 'Leave Approved',
                    body: `Your ${leave.type} request has been auto-approved.`,
                }
            });

            // If Auto-Approved, Update: Notify Dept Admin AND HR Dept AND Super Admin
            const notifyRoles = [Role.SUPER_ADMIN];
            // Find HR Department (Assuming name 'Human Resources')
            const hrDept = await this.prisma.department.findUnique({ where: { name: 'Human Resources' } });

            // Construct notification list
            const recipients: any[] = [];

            // 1. Department Admins (Existing)
            const deptAdmins = await this.prisma.user.findMany({
                where: { departmentId: user.departmentId, role: Role.ADMIN }
            });
            recipients.push(...deptAdmins);

            // 2. Super Admins
            const superAdmins = await this.prisma.user.findMany({
                where: { role: Role.SUPER_ADMIN }
            });
            recipients.push(...superAdmins);

            // 3. HR Admins (if HR dept exists and is not same as current dept)
            if (hrDept && hrDept.id !== user.departmentId) {
                const hrAdmins = await this.prisma.user.findMany({
                    where: { departmentId: hrDept.id, role: Role.ADMIN }
                });
                recipients.push(...hrAdmins);
            }

            // Deduplicate by ID
            const uniqueRecipients = Array.from(new Map(recipients.map(u => [u.id, u])).values());

            if (uniqueRecipients.length > 0) {
                await this.prisma.notification.createMany({
                    data: uniqueRecipients.map(admin => ({
                        userId: admin.id,
                        title: 'Auto-Approved Leave',
                        body: `${user.employee!.firstName} ${user.employee!.lastName}'s ${createLeaveDto.type} was auto-approved.`,
                        type: 'INFO',
                    }))
                });
            }

        } else {
            // PENDING status - Notify Dept Admins only (Standard flow)
            const admins = await this.prisma.user.findMany({
                where: {
                    departmentId: user.departmentId,
                    role: Role.ADMIN,
                }
            });

            if (admins.length > 0) {
                await this.prisma.notification.createMany({
                    data: admins.map(admin => ({
                        userId: admin.id,
                        title: 'New Leave Request',
                        body: `${user.employee!.firstName} ${user.employee!.lastName} requested ${createLeaveDto.type}.`,
                    }))
                });
            }
        }

        return leave;
    }

    async listMine(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
        if (!user || !user.employee) throw new NotFoundException('Employee profile not found');

        return this.prisma.leave.findMany({
            where: { employeeId: user.employee.id },
            orderBy: { requestedAt: 'desc' }
        });
    }

    async listForAdmin(user: any) {
        if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.leave.findMany({ include: { employee: true } });
        } else if (user.role === Role.ADMIN) {
            return this.prisma.leave.findMany({
                where: { departmentId: user.departmentId },
                include: { employee: true }
            });
        }
        return [];
    }

    async updateStatus(id: string, updateLeaveStatusDto: UpdateLeaveStatusDto, user: any) {
        const leave = await this.prisma.leave.findUnique({ where: { id }, include: { employee: true } });
        if (!leave) throw new NotFoundException('Leave not found');

        // Scoping
        if (user.role === Role.ADMIN && leave.departmentId !== user.departmentId) {
            throw new ForbiddenException('Access denied');
        }

        const updatedLeave = await this.prisma.leave.update({
            where: { id },
            data: {
                status: updateLeaveStatusDto.status,
                respondedAt: new Date(),
                respondedBy: user.id,
            }
        });

        // If Approved, deduct tokens (EXCEPT for WFH)
        if (updatedLeave.status === LeaveStatus.APPROVED) {
            // Calculate days
            const start = new Date(updatedLeave.startDate);
            const end = new Date(updatedLeave.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            if (updatedLeave.type !== 'WORK_FROM_HOME') {
                await this.tokensService.deductTokens(updatedLeave.employeeId, updatedLeave.type, diffDays);
            }
        }

        // Notify Employee
        await this.prisma.notification.create({
            data: {
                userId: leave.employee.userId,
                title: `Leave ${updateLeaveStatusDto.status}`,
                body: `Your leave request has been ${updateLeaveStatusDto.status.toLowerCase()}.`,
            }
        });

        return updatedLeave;
    }

    async getMonthlyLeaveUsage(employeeId: string, type: string, date: Date): Promise<number> {
        const year = date.getFullYear();
        const month = date.getMonth();

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);

        const leaves = await this.prisma.leave.findMany({
            where: {
                employeeId,
                type,
                status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] }, // Count pending as potential usage
                startDate: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
        });

        let totalDays = 0;
        for (const leave of leaves) {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            totalDays += diffDays;
        }

        return totalDays;
    }
}
