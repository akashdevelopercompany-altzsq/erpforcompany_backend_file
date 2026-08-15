import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
// Force IDE Refresh
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Role, TaskStatus } from '@prisma/client';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async create(createTaskDto: CreateTaskDto, creator: any) {
        // Validate Employee exists
        const employee = await this.prisma.employee.findUnique({
            where: { id: createTaskDto.employeeId },
            include: { user: true }
        });
        if (!employee) throw new NotFoundException('Employee not found');

        // Check RBAC for Admin
        if (creator.role === Role.ADMIN) {
            if (employee.user.departmentId !== creator.departmentId) {
                throw new ForbiddenException('Cannot assign task to employee in another department');
            }
        }

        const task = await this.prisma.task.create({
            data: {
                employeeId: createTaskDto.employeeId,
                assignedByUserId: creator.id,
                title: createTaskDto.title,
                description: createTaskDto.description,
                dueDate: createTaskDto.dueDate ? new Date(createTaskDto.dueDate) : undefined,
                fileUrl: createTaskDto.fileUrl,
                storedFileId: createTaskDto.storedFileId,
                status: TaskStatus.PENDING,
                priority: (createTaskDto.priority as any) || 'MEDIUM',
            } as any,
            include: { employee: true }
        });

        // Notify Employee
        const taskWithEmployee = task as any;
        await this.notificationsService.createAndBroadcast(
            [taskWithEmployee.employee.userId],
            'TASK_ASSIGN',
            task.id,
            {
                title: 'New Task Assigned',
                message: `You have been assigned a new task: ${task.title}`,
                taskTitle: task.title,
                dueDate: task.dueDate
            }
        );

        return task;
    }

    async findAll(user: any) {
        if (user.role === Role.EMPLOYEE) {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return [];
            return this.prisma.task.findMany({
                where: { employeeId: employee.id },
                orderBy: { createdAt: 'desc' },
                include: { assignedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } } }
            });
        } else if (user.role === Role.ADMIN) {
            // Find tasks for employees in department
            return this.prisma.task.findMany({
                where: {
                    employee: {
                        user: {
                            departmentId: user.departmentId
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                include: { employee: true, submissions: true, dailyReports: { orderBy: { createdAt: 'desc' } } }
            });
        } else if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.task.findMany({
                orderBy: { createdAt: 'desc' },
                include: { employee: true, submissions: true, dailyReports: { orderBy: { createdAt: 'desc' } } }
            });
        }
    }

    async updateStatus(id: string, updateTaskStatusDto: UpdateTaskStatusDto, user: any) {
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: {
                employee: {
                    include: { user: true }
                }
            }
        });
        if (!task) throw new NotFoundException('Task not found');

        if (user.role === Role.EMPLOYEE) {
            if (task.employee.userId !== user.id) throw new ForbiddenException('Access denied');
        } else if (user.role === Role.ADMIN) {
            // Check department
            const employeeUser = await this.prisma.user.findUnique({ where: { id: task.employee.userId } });
            if (employeeUser?.departmentId !== user.departmentId) throw new ForbiddenException('Access denied');
        }

        const updatedTask = await this.prisma.task.update({
            where: { id },
            data: { status: updateTaskStatusDto.status }
        });

        // Notify Admins if Employee updates status
        if (user.role === Role.EMPLOYEE) {
            // 1. Find Dept Admins
            const admins = await this.prisma.user.findMany({
                where: {
                    role: Role.ADMIN,
                    departmentId: task.employee.user.departmentId
                }
            });

            // 2. Find Super Admins
            const superAdmins = await this.prisma.user.findMany({
                where: { role: Role.SUPER_ADMIN }
            });

            const recipients = [...admins, ...superAdmins].map(u => u.id);
            const employeeName = `${task.employee.firstName} ${task.employee.lastName}`;

            if (recipients.length > 0) {
                await this.notificationsService.createAndBroadcast(
                    recipients,
                    'TASK_STATUS_UPDATE',
                    task.id,
                    {
                        title: 'Task Status Updated',
                        message: `Task "${task.title}" status updated to ${updateTaskStatusDto.status} by ${employeeName}`,
                        taskTitle: task.title,
                        status: updateTaskStatusDto.status,
                        updatedBy: employeeName
                    }
                );
            }
        }

        return updatedTask;
    }

    async submitTask(taskId: string, createSubmissionDto: CreateSubmissionDto, userId: string, fileUrl?: string, storedFileId?: string) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { employee: true } });
        if (!task) throw new NotFoundException('Task not found');

        if (task.employee.userId !== userId) throw new ForbiddenException('Access denied');

        return this.prisma.$transaction(async (prisma) => {
            const submission = await prisma.taskSubmission.create({
                data: {
                    taskId,
                    employeeId: task.employeeId,
                    content: createSubmissionDto.content,
                    fileUrl: fileUrl || createSubmissionDto.fileUrl,
                    storedFileId
                }
            });

            await prisma.task.update({
                where: { id: taskId },
                data: { status: TaskStatus.SUBMITTED }
            });

            // Notify Admins
            const creatorUser = await prisma.user.findUnique({ where: { id: task.assignedByUserId } });
            if (creatorUser) {
                await this.notificationsService.createAndBroadcast(
                    [creatorUser.id], // Notify the assigner
                    'TASK_SUBMIT',
                    taskId,
                    {
                        title: 'Task Submitted',
                        message: `${task.employee.firstName} submitted task: ${task.title}`,
                        taskTitle: task.title,
                        employeeName: `${task.employee.firstName} ${task.employee.lastName}`
                    }
                );
            }

            return submission;
        });
    }

    async createDailyReport(taskId: string, userId: string, data: { progress: number; hoursSpent: number; description: string }) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { employee: true } });
        if (!task) throw new NotFoundException('Task not found');
        if (task.employee.userId !== userId) throw new ForbiddenException('Access denied');

        return this.prisma.taskDailyReport.create({
            data: {
                taskId,
                employeeId: task.employeeId,
                progress: data.progress,
                hoursSpent: data.hoursSpent,
                description: data.description
            }
        });
    }

    async reviewTask(submissionId: string, status: string, reviewComment: string, reviewer: any) {
        const submission = await this.prisma.taskSubmission.findUnique({
            where: { id: submissionId },
            include: { task: { include: { employee: { include: { user: true } } } } }
        });
        if (!submission) throw new NotFoundException('Submission not found');

        // RBAC
        if (reviewer.role === Role.ADMIN) {
            if (submission.task.employee.user.departmentId !== reviewer.departmentId) {
                throw new ForbiddenException('Cannot review task for another department');
            }
        }

        return this.prisma.$transaction(async (prisma) => {
            const updatedSubmission = await prisma.taskSubmission.update({
                where: { id: submissionId },
                data: {
                    status: status as any, // Cast to SubmissionStatus
                    reviewComment,
                    reviewedByUserId: reviewer.id
                }
            });

            let taskStatus: TaskStatus = TaskStatus.SUBMITTED;
            if (status === 'APPROVED') taskStatus = TaskStatus.COMPLETED;
            else if (status === 'CHANGES_REQUESTED') taskStatus = TaskStatus.REOPENED; // Or IN_PROGRESS

            await prisma.task.update({
                where: { id: submission.taskId },
                data: { status: taskStatus }
            });

            // Notify Employee
            await this.notificationsService.createAndBroadcast(
                [submission.task.employee.user.id],
                'TASK_REVIEW',
                submission.taskId,
                {
                    title: 'Task Review Update',
                    message: `Your task submission has been ${status}`,
                    taskTitle: submission.task.title,
                    status
                }
            );

            return updatedSubmission;
        });
    }
}
