import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
// Force IDE Refresh
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';


@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private filesService: FilesService
    ) { }

    async me(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                employee: {
                    include: {
                        documents: {
                            include: {
                                uploadedBy: true,
                                storedFile: true
                            }
                        }
                    }
                },
                department: true,
            },
        });

        if (user) {
            return {
                ...user,
                firstName: user.employee?.firstName ?? 'User',
                lastName: user.employee?.lastName ?? '',
                jobTitle: user.employee?.jobTitle ?? user.role,
            };
        }
        return user;
    }

    async findAll(currentUser: any) {
        if (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SENIOR_MANAGER') {
            return this.prisma.user.findMany({
                include: {
                    employee: true,
                    department: true,
                },
            });
        } else if (currentUser.role === 'ADMIN' || currentUser.role === 'DEPARTMENT_MANAGER' || currentUser.role === 'PROJECT_MANAGER') {
            // Managers see their own department/teams ideally, but for simplicity let's limit to Department
            // If project manager, maybe they need to see everyone to pick team members? 
            // For now, let's allow PM to seeing all might be better if cross-dept teams allowed.
            // But let's stick to Dept for now to be safe, or All if prompted. 
            // The requirement: "Project manager will select the department ... then ... department admin will select".
            // So PM selects dept. PM might need to see Depts, not users per se. 
            // But for assigning PM, Senior Manager needs to see all.
            // Let's fallback to Department filter for lower admins.
            return this.prisma.user.findMany({
                where: {
                    departmentId: currentUser.departmentId,
                },
                include: {
                    employee: true,
                    department: true,
                },
            });
        } else {
            return this.prisma.user.findMany({
                where: {
                    id: currentUser.id,
                },
                include: {
                    employee: true,
                    department: true,
                },
            });
        }
    }

    async uploadDocument(file: Express.Multer.File, uploaderId: string, targetEmployeeId: string, type: string, title: string) {
        let category: any = 'EMPLOYEE_DOCUMENT';
        if (type === 'PROFILE_PICTURE' || type === 'PHOTO') category = 'PROFILE_PICTURE';

        const storedFile = await this.filesService.store(file, uploaderId, category);
        const fileUrl = `/files/public/${storedFile.id}`;

        return this.prisma.employeeDocument.create({
            data: {
                employeeId: targetEmployeeId,
                uploadedByUserId: uploaderId,
                type: type as any,
                title,
                fileUrl,
                storedFileId: storedFile.id
            }
        });
    }

    async getDashboardStats(user: any) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = today.getFullYear();

        if (user.role === 'EMPLOYEE') {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return {};

            const attendance = await this.prisma.attendance.findFirst({
                where: { userId: user.id, date: { gte: today } }
            });

            const leaveBalance = await this.prisma.leaveTokenBalance.findMany({
                where: { employeeId: employee.id, year: currentYear }
            });

            const pendingTasks = await this.prisma.task.count({
                where: {
                    employeeId: employee.id,
                    status: { in: ['PENDING', 'IN_PROGRESS', 'REOPENED'] }
                }
            });

            const pendingLeaves = await this.prisma.leave.count({
                where: { employeeId: employee.id, status: 'PENDING' }
            });

            const pendingTickets = await this.prisma.supportTicket.count({
                where: { employeeId: employee.id, status: { not: 'RESOLVED' } }
            });

            const todaysTasks = await this.prisma.task.count({
                where: {
                    employeeId: employee.id,
                    status: { in: ['PENDING', 'IN_PROGRESS', 'REOPENED'] },
                    dueDate: {
                        gte: today,
                        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            });

            const recentPerformance = await this.prisma.performanceReport.findMany({
                where: { employeeId: employee.id },
                orderBy: { createdAt: 'desc' },
                take: 5
            });

            const attendanceRecords = await this.prisma.attendance.count({
                where: {
                    userId: user.id,
                    date: {
                        gte: new Date(currentYear, new Date().getMonth(), 1),
                        lt: new Date(currentYear, new Date().getMonth() + 1, 1)
                    },
                    status: 'PRESENT'
                }
            });
            // Approximate working days so far in month (excluding weekends)
            const daysInMonth = new Date().getDate();
            const attendancePercentage = Math.min(100, Math.round((attendanceRecords / daysInMonth) * 100));

            const resolvedTickets = await this.prisma.supportTicket.count({
                where: { employeeId: employee.id, status: 'RESOLVED' }
            });

            const approvedLeaves = await this.prisma.leave.count({
                where: { employeeId: employee.id, status: 'APPROVED' }
            });

            const totalTokensRemaining = leaveBalance.reduce((acc, b) => acc + b.remaining, 0);

            // --- New Dashboard Stats Calculations ---

            // 1. Task Status
            // Check if any tasks are IN_PROGRESS
            const inProgressTasksCount = await this.prisma.task.count({
                where: { employeeId: employee.id, status: 'IN_PROGRESS' }
            });
            // Status Logic:
            let taskStatus = 'Not Started';
            if (inProgressTasksCount > 0) {
                taskStatus = 'In Progress';
            } else if (pendingTasks > 0) {
                taskStatus = 'Not Started';
            } else {
                // Check if we have completed tasks to say 'Completed' instead of 'Not Started' if 0 pending
                const completedTasksCount = await this.prisma.task.count({
                    where: { employeeId: employee.id, status: 'COMPLETED' }
                });
                if (completedTasksCount > 0 && pendingTasks === 0) {
                    taskStatus = 'Completed';
                }
            }

            // 2. IT Support Stats
            const raisedTicketsCount = await this.prisma.supportTicket.count({
                where: { employeeId: employee.id }
            });

            const latestTicket = await this.prisma.supportTicket.findFirst({
                where: { employeeId: employee.id, category: { not: 'WELLNESS' } }, // Exclude wellness from general IT support if possible, or just take generic
                orderBy: { createdAt: 'desc' }
            });

            let ticketStatus = 'No Tickets';
            if (latestTicket) {
                switch (latestTicket.status) {
                    case 'OPEN': ticketStatus = 'Viewed'; break; // Mapped as requested
                    case 'IN_PROGRESS': ticketStatus = 'Verifying'; break;
                    case 'RESOLVED': ticketStatus = 'Resolved'; break;
                    case 'REJECTED': ticketStatus = 'On Hold'; break;
                    default: ticketStatus = 'Viewed';
                }
            }

            // 3. Wellness Hub Stats
            // Using SupportTicket with category 'WELLNESS'
            const latestWellnessTicket = await this.prisma.supportTicket.findFirst({
                where: { employeeId: employee.id, category: 'WELLNESS' },
                orderBy: { createdAt: 'desc' }
            });

            let wellnessStatus = 'Available'; // Default session status
            if (latestWellnessTicket) {
                switch (latestWellnessTicket.status) {
                    case 'OPEN': wellnessStatus = 'Submitted'; break;
                    case 'IN_PROGRESS': wellnessStatus = 'Under Review'; break; // Or "Scheduled" if we had that detail
                    case 'RESOLVED': wellnessStatus = 'Completed'; break;
                    case 'REJECTED': wellnessStatus = 'Submitted'; break;
                    default: wellnessStatus = 'Submitted';
                }
                // Determine if 'Scheduled' is more appropriate? 
                // Since we don't have a 'SCHEDULED' status, let's assume IN_PROGRESS implies it's being handled/scheduled.
                if (latestWellnessTicket.status === 'IN_PROGRESS') wellnessStatus = 'Scheduled';
            }

            // 5. Learning Stats
            const learningResources = await this.prisma.learningResource.findMany({
                where: { employeeId: employee.id }
            });
            const activeCourses = learningResources.filter(r => ['IN_PROGRESS', 'ASSIGNED'].includes(r.status)).length;
            const completedCourses = learningResources.filter(r => r.status === 'COMPLETED').length;

            let learningStatus = 'Not Started';
            if (activeCourses > 0) learningStatus = 'In Progress';
            else if (completedCourses > 0) learningStatus = 'Up to Date';

            // 6. Hike Eligibility (Defaults, refined below)
            let hikeEligibility = 'Not Eligible';
            let hikeReason = 'Tenure < 1 Year';

            // 7. Achievements (Defaults, refined below)
            let achievement = 'Rising Star';

            // 4. Yearly Performance Analysis (Monthly Detailed Breakdown)
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31);

            // Fetch all necessary data for the year in parallel
            const [yearlyPerfReports, yearlyDailyReports, yearlyLeaves, yearlyMeetings, yearlyAttendance, yearlyCalendarEvents] = await Promise.all([
                this.prisma.performanceReport.findMany({
                    where: {
                        employeeId: employee.id,
                        createdAt: { gte: startOfYear, lte: endOfYear }
                    },
                    select: { createdAt: true, rating: true }
                }),
                this.prisma.taskDailyReport.findMany({
                    where: {
                        employeeId: employee.id,
                        createdAt: { gte: startOfYear, lte: endOfYear }
                    },
                    select: { createdAt: true }
                }),
                this.prisma.leave.findMany({
                    where: {
                        employeeId: employee.id,
                        startDate: { gte: startOfYear, lte: endOfYear }
                    },
                    select: { startDate: true, endDate: true, status: true, type: true }
                }),
                this.prisma.meetingAttendance.findMany({
                    where: {
                        employeeId: employee.id,
                        meeting: { scheduledAt: { gte: startOfYear, lte: endOfYear } }
                    },
                    include: { meeting: true }
                }),
                this.prisma.attendance.findMany({
                    where: {
                        userId: employee.userId,
                        date: { gte: startOfYear, lte: endOfYear }
                    },
                    select: { date: true, checkIn: true, status: true }
                }),
                this.prisma.calendarEvent.findMany({
                    where: {
                        date: { gte: startOfYear, lte: endOfYear },
                        type: { in: ['HOLIDAY', 'SHUTDOWN'] }
                    }
                })
            ]);

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

            const yearlyPerformance = monthNames.map((monthName, index) => {
                const daysInMonth = new Date(currentYear, index + 1, 0).getDate();
                const reportsInMonth = yearlyPerfReports.filter(r => r.createdAt.getMonth() === index);
                const dailyReportsInMonth = yearlyDailyReports.filter(r => r.createdAt.getMonth() === index);
                const leavesInMonth = yearlyLeaves.filter(l => l.startDate.getMonth() === index);
                const meetingsInMonth = yearlyMeetings.filter(m => new Date(m.meeting.scheduledAt).getMonth() === index);
                const attendanceInMonth = yearlyAttendance.filter(a => a.date.getMonth() === index);
                const holidaysInMonth = yearlyCalendarEvents.filter(e => e.date.getMonth() === index);

                let currentEfficiency = 100;

                // Iterate every day
                for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(currentYear, index, d);
                    if (date > new Date()) continue; // Skip future

                    const dayOfWeek = date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    const isHoliday = holidaysInMonth.some(h => isSameDay(h.date, date));
                    const isLeave = leavesInMonth.some(l =>
                        date >= new Date(l.startDate) &&
                        (l.endDate ? date <= new Date(l.endDate) : isSameDay(date, new Date(l.startDate))) &&
                        l.status === 'APPROVED'
                    );

                    // Working Day Check
                    if (!isWeekend && !isHoliday && !isLeave) {
                        // 1. Daily Report Check
                        const report = dailyReportsInMonth.find(r => isSameDay(r.createdAt, date));
                        if (!report) {
                            currentEfficiency -= 0.1; // Missing
                        } else {
                            const submissionHour = new Date(report.createdAt).getHours();
                            if (submissionHour >= 18) currentEfficiency -= 0.1; // Late
                        }

                        // 2. Attendance / Cab Check
                        const att = attendanceInMonth.find(a => isSameDay(a.date, date));
                        if (att && att.checkIn) {
                            const h = new Date(att.checkIn).getHours();
                            if (h >= 10 && new Date(att.checkIn).getMinutes() > 0) currentEfficiency -= 0.5;
                        }
                    }
                }

                // 3. Project Reports (Global penalty for month)
                if (reportsInMonth.length === 0 && index < new Date().getMonth()) {
                    currentEfficiency -= 2.0;
                }

                // 4. Leave Penalties and Meetings
                // LOP
                let lopDays = 0;
                let unauthorizedDays = 0;
                leavesInMonth.forEach(leave => {
                    const start = new Date(leave.startDate);
                    const end = leave.endDate ? new Date(leave.endDate) : start;
                    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    if (leave.status === 'REJECTED' || (leave.status === 'PENDING' && start < new Date())) unauthorizedDays += duration;
                    else if (leave.status === 'APPROVED' && leave.type === 'LOP') lopDays += duration;
                });
                currentEfficiency -= (unauthorizedDays * 0.5);
                currentEfficiency -= (Math.floor(lopDays / 2) * 0.5);

                // Meetings
                meetingsInMonth.forEach(ma => {
                    if (!ma.attended || !ma.reportSubmitted) currentEfficiency -= 0.5;
                });

                currentEfficiency = Math.max(0, Math.min(100, currentEfficiency));
                const totalRating = reportsInMonth.reduce((sum, r) => sum + (r.rating || 0), 0);
                const avgRating = reportsInMonth.length > 0 ? totalRating / reportsInMonth.length : 0;

                return {
                    month: monthName,
                    rating: parseFloat(avgRating.toFixed(1)),
                    efficiency: parseFloat(currentEfficiency.toFixed(1)),
                    reportCount: dailyReportsInMonth.length
                };
            });

            // Get current month's efficiency from the yearly calculation above
            const currentMonthIndex = new Date().getMonth();
            const currentMonthPerformance = yearlyPerformance[currentMonthIndex];
            const avgEfficiency = currentMonthPerformance ? currentMonthPerformance.efficiency : 100;

            // Re-calculate Hike & Achievement based on computed stats
            if (employee.joinDate) {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(today.getFullYear() - 1);
                if (employee.joinDate <= oneYearAgo) {
                    if (avgEfficiency >= 80) {
                        hikeEligibility = 'Eligible';
                        hikeReason = 'Reference Performance';
                    } else {
                        hikeEligibility = 'Review Pending';
                        hikeReason = 'Efficiency < 80%';
                    }
                }
            }

            // Refine Achievement (Simple logic for now)
            if (recentPerformance.length > 0 && recentPerformance[0].rating && recentPerformance[0].rating >= 4.5) {
                achievement = 'Star Performer';
            } else if (attendancePercentage >= 95) {
                achievement = 'Perfect Attendance';
            } else if (completedCourses > 5) {
                achievement = 'Quick Learner';
            }

            return {
                role: 'EMPLOYEE',
                attendance,
                leaveBalance,
                pendingTasks,
                pendingLeaves,
                pendingTickets,
                todaysTasks,
                recentPerformance,
                attendancePercentage,
                resolvedTickets,
                approvedLeaves,
                totalTokensRemaining,
                avgEfficiency,
                // New Fields
                taskStatus,
                raisedTicketsCount,
                ticketStatus,
                wellnessStatus,
                yearlyPerformance,
                // Newly Added Derived Stats
                learningStatus,
                activeCourses,
                completedCourses,
                hikeEligibility,
                hikeReason,
                achievement
            };

        } else if (user.role === 'ADMIN') {
            if (!user.departmentId) {
                return {
                    role: 'ADMIN',
                    totalEmployees: 0,
                    pendingLeaves: 0,
                    pendingTasks: 0,
                    avgPerformance: 0
                };
            }

            const totalEmployees = await this.prisma.user.count({
                where: { departmentId: user.departmentId, role: 'EMPLOYEE' }
            });

            const pendingLeaves = await this.prisma.leave.count({
                where: { departmentId: user.departmentId, status: 'PENDING' }
            });

            const pendingTasks = await this.prisma.task.count({
                where: {
                    employee: { user: { departmentId: user.departmentId } },
                    status: 'PENDING'
                }
            });

            // Average Performance
            const reports = await this.prisma.performanceReport.findMany({
                where: { employee: { user: { departmentId: user.departmentId } } },
                select: { rating: true }
            });
            const totalRating = reports.reduce((acc, r) => acc + (r.rating || 0), 0);
            const avgPerformance = reports.length ? totalRating / reports.length : 0;

            const recentPendingLeaves = await this.prisma.leave.findMany({
                where: { departmentId: user.departmentId, status: 'PENDING' },
                orderBy: { requestedAt: 'desc' },
                take: 5,
                include: { employee: true }
            });

            return {
                role: 'ADMIN',
                totalEmployees,
                pendingLeaves,
                pendingTasks,
                avgPerformance,
                recentPendingLeaves
            };
        } else if (user.role === 'SUPER_ADMIN') {
            const totalEmployees = await this.prisma.user.count();
            const totalDepartments = await this.prisma.department.count();
            const pendingLeaves = await this.prisma.leave.count({ where: { status: 'PENDING' } });

            const recentPendingLeaves = await this.prisma.leave.findMany({
                where: { status: 'PENDING' },
                orderBy: { requestedAt: 'desc' },
                take: 5,
                include: { employee: true, department: true }
            });

            // Global Average Performance
            const reports = await this.prisma.performanceReport.findMany({ select: { rating: true } });
            const totalRating = reports.reduce((acc, r) => acc + (r.rating || 0), 0);
            const avgPerformance = reports.length ? totalRating / reports.length : 0;

            return {
                role: 'SUPER_ADMIN',
                totalEmployees,
                totalDepartments,
                pendingLeaves,
                avgPerformance,
                recentPendingLeaves
            };
        }
    }
}
