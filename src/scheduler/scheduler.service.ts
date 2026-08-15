import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

import { EfficiencyService } from '../performance/efficiency.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private prisma: PrismaService,
        private efficiencyService: EfficiencyService
    ) { }

    // Daily Report Reminder - 5:55 PM (5 mins before 6 PM)
    @Cron('55 17 * * 1-5')
    async handleDailyReportPreReminder() {
        this.logger.debug('Running 5:55 PM Daily Report Reminder');
        await this.sendDailyReportReminders('Daily Report Due in 5 Minutes!', 'Please submit your daily task report by 6:00 PM to avoid efficiency penalty.');
    }

    // Daily Report Final Countdown - 5:58 PM (2 mins before 6 PM)
    @Cron('58 17 * * 1-5')
    async handleDailyReportFinalReminder() {
        this.logger.debug('Running 5:58 PM Final Daily Report Reminder');
        await this.sendDailyReportReminders('URGENT: 2 Minutes Left!', 'Submit your daily report NOW or face -0.1% efficiency penalty.');
    }

    private async sendDailyReportReminders(title: string, body: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all active employees
        const employees = await this.prisma.employee.findMany({
            include: { user: true }
        });

        for (const emp of employees) {
            // Check if report exists
            const report = await this.prisma.taskDailyReport.findFirst({
                where: {
                    employeeId: emp.id,
                    createdAt: { gte: today, lt: tomorrow }
                }
            });

            if (!report) {
                // Send Notification
                await this.prisma.notification.create({
                    data: {
                        userId: emp.userId,
                        title: title,
                        body: body,
                        type: 'WARNING',
                        read: false
                    }
                });
            }
        }
    }

    // Check Project Deadlines (Every Hour)
    @Cron(CronExpression.EVERY_HOUR)
    async checkProjectDeadlines() {
        this.logger.debug('Checking Project Deadlines');
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const reports = await this.prisma.performanceReport.findMany({
            where: {
                dueDate: {
                    gt: now,
                    lte: oneHourLater
                },
                submissionDate: null
            } as any,
            include: {
                employee: {
                    include: { user: true }
                }
            }
        });

        // Cast to any to bypass stale type definitions
        for (const r of reports) {
            const report = r as any;
            if (report.employee?.user && report.dueDate) {
                const minutesLeft = Math.floor((new Date(report.dueDate).getTime() - now.getTime()) / 60000);

                await this.prisma.notification.create({
                    data: {
                        userId: report.employee.user.id,
                        title: 'Project Report Deadline Approaching',
                        body: `Your report for project "${report.projectName}" is due in ${minutesLeft} minutes. Please submit it to avoid penalties.`,
                        type: 'WARNING',
                        read: false
                    }
                });
                this.logger.log(`Sent deadline notification to ${report.employee.user.email} for report ${report.id}`);
            }
        }
    }

    // Weekly Efficiency Calculation - Sunday at 11:59 PM
    @Cron('59 23 * * 0')
    async handleWeeklyEfficiency() {
        this.logger.log('Running Weekly Efficiency Calculation');
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6); // Last 7 days

        // Trigger calculation for all employees
        await this.triggerEfficiencyCalculation('WEEKLY', start, end);
    }

    // Monthly Efficiency Calculation - 1st of Month at 12:05 AM (for previous month)
    @Cron('5 0 1 * *')
    async handleMonthlyEfficiency() {
        this.logger.log('Running Monthly Efficiency Calculation');
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0); // Last day of previous month
        end.setHours(23, 59, 59, 999);

        await this.triggerEfficiencyCalculation('MONTHLY', start, end);
    }

    private async triggerEfficiencyCalculation(period: any, start: Date, end: Date) {
        const employees = await this.prisma.employee.findMany();
        for (const emp of employees) {
            try {
                await this.efficiencyService.calculateEfficiency(emp.id, period, start, end);
            } catch (error) {
                this.logger.error(`Failed efficiency calc for ${emp.id}`, error);
            }
        }
    }
}
