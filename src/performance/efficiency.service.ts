import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class EfficiencyService {
    private readonly logger = new Logger(EfficiencyService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Calculate efficiency for a specific employee and period
     */
    async calculateEfficiency(employeeId: string, period: any, startDate: Date, endDate: Date) {
        // 1. Fetch Employee Data
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { user: true }
        });

        if (!employee) return 0;

        let score = 100;
        const breakdown: any = {};

        // 2. Attendance & Cab Penalty (0.5% loss per late/miss)
        // Check for Attendance records in range
        const attendanceRecords = await this.prisma.attendance.findMany({
            where: {
                userId: employee.userId,
                date: { gte: startDate, lte: endDate }
            }
        });

        // Determine working days (excluding Sundays) - Simple approximation
        // In a real app, we'd check a Holiday/Calendar table
        let workingDays = 0;
        let daysChecked = 0;
        const currentCheck = new Date(startDate);
        while (currentCheck <= endDate && currentCheck <= new Date()) { // Don't check future
            if (currentCheck.getDay() !== 0) { // Not Sunday
                workingDays++;

                // Check if attended
                const record = attendanceRecords.find(r =>
                    r.date.getDate() === currentCheck.getDate() &&
                    r.date.getMonth() === currentCheck.getMonth()
                );

                if (!record) {
                    // Check if on approved leave
                    const isOnLeave = await this.checkIfOnLeave(employee.id, currentCheck);
                    if (!isOnLeave) {
                        // Absent without permission
                        score -= 0.5;
                        breakdown['absent_nopermission'] = (breakdown['absent_nopermission'] || 0) - 0.5;
                    }
                } else if (record.status === 'LATE') {
                    score -= 0.5;
                    breakdown['late_arrival'] = (breakdown['late_arrival'] || 0) - 0.5;
                }
            }
            currentCheck.setDate(currentCheck.getDate() + 1);
            daysChecked++;
        }

        // 3. Daily Reports (0.5% loss if missed)
        // Check TaskDailyReport
        const dailyReports = await this.prisma.taskDailyReport.findMany({
            where: {
                employeeId: employee.id,
                createdAt: { gte: startDate, lte: endDate }
            }
        });

        // Loop through working days again to check for reports
        // Reset date
        const reportCheckDate = new Date(startDate);
        while (reportCheckDate <= endDate && reportCheckDate <= new Date()) {
            if (reportCheckDate.getDay() !== 0) {
                const isOnLeave = await this.checkIfOnLeave(employee.id, reportCheckDate);
                if (!isOnLeave) {
                    const hasReport = dailyReports.some(r =>
                        r.createdAt.getDate() === reportCheckDate.getDate() &&
                        r.createdAt.getMonth() === reportCheckDate.getMonth()
                    );

                    if (!hasReport) {
                        score -= 0.5;
                        breakdown['missed_daily_report'] = (breakdown['missed_daily_report'] || 0) - 0.5;
                    }
                }
            }
            reportCheckDate.setDate(reportCheckDate.getDate() + 1);
        }

        // 4. Project/Performance Reports (0.5% loss if missed deadline)
        // Check PerformanceReport due in this range
        const projectReports = await this.prisma.performanceReport.findMany({
            where: {
                employeeId: employee.id,
                dueDate: { gte: startDate, lte: endDate }
            } as any
        });

        for (const r of projectReports) {
            const report = r as any;
            if (!report.submissionDate && report.dueDate && new Date() > report.dueDate) {
                score -= 0.5;
                breakdown['missed_project_deadline'] = (breakdown['missed_project_deadline'] || 0) - 0.5;
            } else if (report.submissionDate && report.dueDate && report.submissionDate > report.dueDate) {
                // Late submission
                score -= 0.5;
                breakdown['late_project_submission'] = (breakdown['late_project_submission'] || 0) - 0.5;
            }
        }

        // 5. Leave without Permission (LOP)
        // 2 days = 0.5%, 3 days = 1%, 5 days = 3%
        // We need to count total Absent days that are NOT approved leaves
        // This logic is partially covered in step 2 (Absent), but we need to aggregate for the scaling penalty.
        // For simplicity, I'll stick to the per-day penalty in step 2, or implement the scaling here.
        // Let's implement scaling based on 'absent_count'.

        let absentDays = 0;
        // Re-calculate absent counts for scaling
        const absentCheckDate = new Date(startDate);
        while (absentCheckDate <= endDate && absentCheckDate <= new Date()) {
            if (absentCheckDate.getDay() !== 0) {
                const record = attendanceRecords.find(r => r.date.toDateString() === absentCheckDate.toDateString());
                if (!record) {
                    const isOnLeave = await this.checkIfOnLeave(employee.id, absentCheckDate);
                    if (!isOnLeave) absentDays++;
                }
            }
            absentCheckDate.setDate(absentCheckDate.getDate() + 1);
        }

        if (absentDays >= 5) {
            score -= 3.0;
            breakdown['excessive_absenteeism'] = -3.0;
        } else if (absentDays >= 3) {
            score -= 1.0;
            breakdown['excessive_absenteeism'] = -1.0;
        } else if (absentDays >= 2) {
            score -= 0.5;
            breakdown['excessive_absenteeism'] = -0.5;
        }

        // 6. Discussion/Meeting (0.5% loss if missed, 1% if failed involvement)
        // Check MeetingAttendance
        const meetings = await this.prisma.meetingAttendance.findMany({
            where: {
                employeeId: employee.id,
                meeting: {
                    scheduledAt: { gte: startDate, lte: endDate }
                }
            },
            include: { meeting: true }
        });

        for (const att of meetings) {
            if (!att.attended) {
                score -= 0.5;
                breakdown['missed_meeting'] = (breakdown['missed_meeting'] || 0) - 0.5;
            }
            // Logic for "failed involvement" - assuming 'reportSubmitted' implies involvement or admin flag
            // If they attended but didn't submit minutes/report? 
            if (att.attended && !att.reportSubmitted) {
                score -= 1.0;
                breakdown['poor_meeting_involvement'] = (breakdown['poor_meeting_involvement'] || 0) - 1.0;
            }
        }

        // 7. Self Development (5% Bonus for each completed course)
        const completedCourses = await this.prisma.learningResource.findMany({
            where: {
                employeeId: employee.id,
                status: 'COMPLETED',
                storedFile: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            },
            include: { storedFile: true }
        });

        if (completedCourses.length > 0) {
            const bonus = completedCourses.length * 5;
            score += bonus;
            breakdown['self_development_bonus'] = bonus;
        }

        // 8. Loging time - assuming covered by late arrival in Step 2.

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        // Save Record
        await (this.prisma as any).efficiencyRecord.create({
            data: {
                employeeId: employee.id,
                period,
                startDate,
                endDate,
                score,
                breakdown
            }
        });

        return score;
    }

    private async checkIfOnLeave(employeeId: string, date: Date): Promise<boolean> {
        const leave = await this.prisma.leave.findFirst({
            where: {
                employeeId,
                status: 'APPROVED',
                startDate: { lte: date },
                endDate: { gte: date }
            }
        });
        return !!leave;
    }
}
