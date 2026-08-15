import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePerformanceReportDto } from './dto/create-performance-report.dto';
import { Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { EfficiencyService } from './efficiency.service';

@Injectable()
export class PerformanceService {
    constructor(
        private prisma: PrismaService,
        private efficiencyService: EfficiencyService,
        private notificationsService: NotificationsService
    ) { }

    async create(dto: CreatePerformanceReportDto, creator: any, storedFileId?: string) {
        // Employee creates report (uploads file)
        // Admin can also create
        let employeeId = dto.employeeId;
        if (creator.role === Role.EMPLOYEE) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: creator.id } });
            if (!employee) throw new NotFoundException('Employee profile not found');
            employeeId = employee.id;
        } else if (creator.role === Role.ADMIN) {
            const employee = await this.prisma.employee.findUnique({
                where: { id: dto.employeeId },
                include: { user: true }
            });
            if (!employee) throw new NotFoundException('Employee not found');
            if (employee.user.departmentId !== creator.departmentId) {
                throw new ForbiddenException('Cannot create report for employee in another department');
            }
        }

        const report = await this.prisma.performanceReport.create({
            data: {
                employeeId,
                title: dto.title,
                projectName: dto.projectName,
                periodStart: dto.periodStart,
                periodEnd: dto.periodEnd,
                fileUrl: dto.fileUrl,
                storedFileId: storedFileId,
                rating: creator.role !== Role.EMPLOYEE ? dto.rating : null, // Only Admin can set rating initially
            }
        });

        // Notify Admins
        // Find department of employee
        const empUser = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
        if (empUser && empUser.user.departmentId) {
            const admins = await this.getAdminsForDepartment(empUser.user.departmentId);
            const adminIds = admins.map(a => a.id);
            const employeeName = `${empUser.firstName} ${empUser.lastName}`;

            await this.notificationsService.createAndBroadcast(
                adminIds,
                'REPORT_SUBMIT',
                report.id,
                {
                    title: 'New Performance Report',
                    message: `${employeeName} submitted a report: ${dto.title}`,
                    employeeName,
                    projectName: dto.projectName
                }
            );
        }

        return report;
    }

    async update(id: string, dto: any, user: any) {
        const report = await this.prisma.performanceReport.findUnique({ where: { id }, include: { employee: { include: { user: true } } } });
        if (!report) throw new NotFoundException('Report not found');

        if (user.role === Role.ADMIN) {
            if (report.employee?.user?.departmentId !== user.departmentId) {
                throw new ForbiddenException('Cannot update report for another department');
            }
        } else if (user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only Admins can update reports');
        }

        return this.prisma.performanceReport.update({
            where: { id },
            data: {
                rating: dto.rating,
                feedback: dto.feedback,
                reviewerId: user.id
            }
        });
    }

    async getAnalysis(user: any, period: 'WEEKLY' | 'MONTHLY' | 'YEARLY') {
        const now = new Date();
        const startDate = new Date();

        let days = 7;
        if (period === 'WEEKLY') {
            startDate.setDate(now.getDate() - 7);
            days = 7;
        } else if (period === 'MONTHLY') {
            startDate.setDate(now.getDate() - 30);
            days = 30;
        } else if (period === 'YEARLY') {
            startDate.setFullYear(now.getFullYear() - 1);
            days = 365; // Approximate, Logic handles monthly aggregation
        }

        let whereClause: any = {
            createdAt: { gte: startDate }
        };

        if (user.role === Role.ADMIN) {
            whereClause = {
                ...whereClause,
                employee: { user: { departmentId: user.departmentId } }
            };
        } else if (user.role === Role.EMPLOYEE) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return { period, averageRating: 0, totalReports: 0, reports: [], hikeEligibility: false };
            whereClause = {
                ...whereClause,
                employeeId: employee.id
            };
        }

        // Fetch basic Performance Reports for ratings
        const reports = await this.prisma.performanceReport.findMany({
            where: {
                ...whereClause,
                rating: { not: null }
            },
            select: {
                rating: true,
                createdAt: true,
                employee: { select: { firstName: true, lastName: true } }
            }
        });

        // Fetch data for Efficiency Calculation
        const [dailyReports, leaves, attendanceRecords, calendarEvents] = await this.prisma.$transaction([
            this.prisma.taskDailyReport.findMany({
                where: {
                    ...whereClause,
                    createdAt: { gte: startDate }
                }
            }),
            this.prisma.leave.findMany({
                where: {
                    employeeId: whereClause.employeeId,
                    startDate: { gte: startDate }
                }
            }),
            this.prisma.attendance.findMany({
                where: {
                    userId: user.id,
                    date: { gte: startDate }
                }
            }),
            this.prisma.calendarEvent.findMany({
                where: {
                    date: { gte: startDate },
                    type: { in: ['HOLIDAY', 'SHUTDOWN'] }
                }
            })
        ]);

        const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

        // --- YEARLY AGGREGATION ---
        if (period === 'YEARLY') {
            const monthlyData: { month: string, efficiency: number, rating: number, hours: number }[] = [];

            for (let i = 0; i < 12; i++) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = monthDate.toLocaleString('default', { month: 'long' });

                // Filter data for this month
                const monthReports = dailyReports.filter(r => r.createdAt.getMonth() === monthDate.getMonth() && r.createdAt.getFullYear() === monthDate.getFullYear());
                const monthRatings = reports.filter(r => r.createdAt.getMonth() === monthDate.getMonth() && r.createdAt.getFullYear() === monthDate.getFullYear());
                const monthAttendance = attendanceRecords.filter(a => a.date.getMonth() === monthDate.getMonth() && a.date.getFullYear() === monthDate.getFullYear());

                // Avg Rating
                const avgRating = monthRatings.length > 0 ? monthRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / monthRatings.length : 0;

                // Avg Hours (approx)
                const totalHours = monthAttendance.reduce((sum, att) => {
                    if (att.checkIn && att.checkOut) {
                        const raw = (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / 36e5;
                        return sum + (raw > 5 ? raw - 1 : raw);
                    }
                    return sum;
                }, 0);
                const avgHours = monthAttendance.length > 0 ? totalHours / monthAttendance.length : 0;

                // Mock efficiency based on completion
                const efficiency = Math.min(100, (monthReports.length / 20) * 100);

                monthlyData.push({
                    month: monthName,
                    efficiency: parseFloat(efficiency.toFixed(1)),
                    rating: parseFloat(avgRating.toFixed(1)),
                    hours: parseFloat(avgHours.toFixed(1))
                });
            }

            return {
                period,
                reports: monthlyData.reverse(), // Show Jan -> Dec order typically, or reverse chronological
                hikeEligibility: reports.length > 5 && (reports.reduce((a, b) => a + (b.rating || 0), 0) / reports.length) > 8
            };
        }

        // 3. Self Development Efficiency Bonus
        const completedCourses = await this.prisma.learningResource.findMany({
            where: {
                employeeId: whereClause.employeeId,
                status: 'COMPLETED',
                createdAt: { gte: startDate }
            }
        });

        // 5% bonus per course
        const courseBonus = completedCourses.length * 5;

        // --- DAILY AGGREGATION (Weekly/Monthly) ---
        const dailyEfficiencyAndRatings: { date: string, efficiency: number, rating: number, hours: number }[] = [];
        let totalEfficiency = 0;

        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            if (date > now) break;

            let dailyEff = 100;
            let hours = 0;
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = calendarEvents.some(e => isSameDay(new Date(e.date), date));
            const isLeave = leaves.some(l =>
                date >= new Date(l.startDate) &&
                (l.endDate ? date <= new Date(l.endDate) : isSameDay(date, new Date(l.startDate))) &&
                l.status === 'APPROVED'
            );

            // Attendance Hours Calculation
            const att = attendanceRecords.find(a => isSameDay(a.date, date));
            if (att && att.checkIn) {
                const checkOutTime = att.checkOut ? new Date(att.checkOut) : (isSameDay(date, new Date()) ? new Date() : null);
                if (checkOutTime) {
                    const rawHours = (checkOutTime.getTime() - new Date(att.checkIn).getTime()) / 36e5;
                    // Deduct 1 hour break if working more than 5 hours (e.g. 9-6 = 9h span -> 8h work)
                    hours = rawHours > 5 ? rawHours - 1 : rawHours;
                }
            }

            if (!isWeekend && !isHoliday && !isLeave) {
                // 1. Daily Report Check
                const report = dailyReports.find(r => isSameDay(r.createdAt, date));
                if (!report) {
                    dailyEff -= 0.1; // Missing report penalty
                } else {
                    const submissionHour = new Date(report.createdAt).getHours();
                    if (submissionHour >= 18) dailyEff -= 0.1; // Late penalty
                }

                // 2. Attendance Check
                if (att && att.checkIn) {
                    const h = new Date(att.checkIn).getHours();
                    if (h >= 10 && new Date(att.checkIn).getMinutes() > 0) dailyEff -= 0.5; // Late check-in penalty
                } else {
                    // Absent penalty (if strictly working day)
                    if (date < new Date()) dailyEff = 0;
                }
            } else {
                if (!att) dailyEff = 0; // Show 0 efficiency on non-working days if no attendance
            }

            // Normalize base efficiency
            dailyEff = Math.max(0, Math.min(100, dailyEff));

            // Apply Course Bonus (Max + 100 might be too much, let's just add it to the daily score, capped at 100)
            // Or should the bonus be separate? "Calculate into efficiency" usually means boosting the score.
            if (dailyEff > 0) {
                dailyEff = Math.min(100, dailyEff + courseBonus);
            }

            if (isWeekend || isHoliday) dailyEff = hours > 0 ? 100 : 0; // If they worked on weekend, give full efficiency credit?

            // Get rating for this day if exists
            const dayReports = reports.filter(r => isSameDay(r.createdAt, date));
            const avgRating = dayReports.length > 0
                ? dayReports.reduce((sum, r) => sum + (r.rating || 0), 0) / dayReports.length
                : 0;

            dailyEfficiencyAndRatings.push({
                date: date.toISOString(),
                efficiency: parseFloat(dailyEff.toFixed(1)),
                rating: parseFloat(avgRating.toFixed(1)),
                hours: parseFloat(hours.toFixed(1))
            });

            totalEfficiency += dailyEff;
        }

        const avgEfficiency = dailyEfficiencyAndRatings.length > 0
            ? totalEfficiency / dailyEfficiencyAndRatings.length
            : 100;

        // Simple aggregation: Average rating (keep existing logic for backward compat if needed, or update)
        const total = reports.reduce((acc, r) => acc + (r.rating || 0), 0);
        const average = reports.length > 0 ? total / reports.length : 0;

        // Hike Eligibility Logic: Average rating > 8.0 AND at least 1 report
        const hikeEligibility = average > 8.0 && reports.length > 0;

        return {
            period,
            startDate,
            endDate: now,
            averageRating: average,
            averageEfficiency: parseFloat(avgEfficiency.toFixed(1)),
            totalReports: reports.length,
            hikeEligibility,
            reports: dailyEfficiencyAndRatings // Return new structure
        };
    }

    async findAll(user: any) {
        if (user.role === Role.EMPLOYEE) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return [];
            return this.prisma.performanceReport.findMany({
                where: { employeeId: employee.id },
                orderBy: { createdAt: 'desc' },
                include: { reviewer: { select: { email: true } } }
            });
        } else if (user.role === Role.ADMIN) {
            return this.prisma.performanceReport.findMany({
                where: {
                    employee: {
                        user: {
                            departmentId: user.departmentId
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                include: { employee: true, reviewer: true }
            });
        } else if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.performanceReport.findMany({
                orderBy: { createdAt: 'desc' },
                include: { employee: true, reviewer: true }
            });
        }
    }

    private async getAdminsForDepartment(departmentId: string) {
        return this.prisma.user.findMany({
            where: {
                OR: [
                    { role: Role.SUPER_ADMIN },
                    { role: Role.ADMIN, departmentId }
                ]
            }
        });
    }
}
