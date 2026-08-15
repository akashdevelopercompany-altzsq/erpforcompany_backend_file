import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class TokensService {
    constructor(private prisma: PrismaService) { }

    async getBalancesByUserId(userId: string) {
        const employee = await this.prisma.employee.findUnique({
            where: { userId },
        });
        if (!employee) throw new NotFoundException('Employee record not found');
        return this.getBalances(employee.id);
    }

    async getBalances(employeeId: string) {
        const currentYear = new Date().getFullYear();

        // Ensure balances exist for current year
        await this.ensureBalancesExist(employeeId, currentYear);

        return this.prisma.leaveTokenBalance.findMany({
            where: {
                employeeId,
                year: currentYear,
            },
        });
    }

    async ensureBalancesExist(employeeId: string, year: number) {
        const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee) throw new NotFoundException('Employee not found');

        const requiredBalances = [
            { type: 'SICK', total: 12 },
            { type: 'CASUAL', total: 18 },
            { type: 'PERMISSION', total: 6 },
            { type: 'LOSS_OF_PAY', total: 5 },
            { type: 'WORK_FROM_HOME', total: 24 },
        ];

        if (employee.gender === 'FEMALE') {
            requiredBalances.push({ type: 'MENSTRUATION', total: 24 });
        }

        for (const b of requiredBalances) {
            const existing = await this.prisma.leaveTokenBalance.findUnique({
                where: {
                    employeeId_year_type: {
                        employeeId,
                        year,
                        type: b.type
                    }
                }
            });

            if (!existing) {
                await this.prisma.leaveTokenBalance.create({
                    data: {
                        employeeId,
                        year,
                        type: b.type,
                        total: b.total,
                        remaining: b.total,
                        used: 0,
                    },
                });
            }
        }
    }

    async validateAdminAccess(adminUser: any, targetEmployeeId: string) {
        if (adminUser.role === Role.SUPER_ADMIN) return;

        const employee = await this.prisma.employee.findUnique({
            where: { id: targetEmployeeId },
            include: { user: true },
        });

        if (!employee) throw new NotFoundException('Employee not found');

        // Check department
        // Employee -> User -> DepartmentId
        // Or Employee -> Department (via User usually, schema says User has departmentId)
        // Wait, schema says User has departmentId. Employee doesn't have direct departmentId?
        // Let's check schema.
        // Schema: User has departmentId. Employee has userId.
        // So we need to check employee.user.departmentId

        if (employee.user.departmentId !== adminUser.departmentId) {
            throw new ForbiddenException('Access denied: Employee belongs to another department');
        }
    }

    async checkBalance(employeeId: string, type: string, days: number) {
        const currentYear = new Date().getFullYear();
        await this.ensureBalancesExist(employeeId, currentYear);

        const balance = await this.prisma.leaveTokenBalance.findUnique({
            where: {
                employeeId_year_type: {
                    employeeId,
                    year: currentYear,
                    type,
                },
            },
        });

        if (!balance) throw new NotFoundException(`No balance found for leave type ${type}`);
        if (balance.remaining < days) {
            return false;
        }
        return true;
    }

    async deductTokens(employeeId: string, type: string, days: number) {
        const currentYear = new Date().getFullYear();
        // Ensure exists
        await this.ensureBalancesExist(employeeId, currentYear);

        const balance = await this.prisma.leaveTokenBalance.findUnique({
            where: {
                employeeId_year_type: {
                    employeeId,
                    year: currentYear,
                    type,
                },
            },
        });

        if (!balance || balance.remaining < days) {
            throw new ForbiddenException('Insufficient leave balance');
        }

        await this.prisma.leaveTokenBalance.update({
            where: { id: balance.id },
            data: {
                used: { increment: days },
                remaining: { decrement: days },
            },
        });
    }
}
