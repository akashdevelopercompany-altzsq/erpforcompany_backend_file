import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingsService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async create(createMeetingDto: CreateMeetingDto, creatorId: string) {
        // 1. Create Meeting
        const meeting = await this.prisma.meeting.create({
            data: {
                title: createMeetingDto.title,
                description: createMeetingDto.description,
                scheduledAt: new Date(createMeetingDto.scheduledAt),
                duration: Number(createMeetingDto.duration),
                type: createMeetingDto.type,
            }
        });

        // 2. Add Participants
        if (createMeetingDto.participantIds && createMeetingDto.participantIds.length > 0) {
            // Validate Employees
            const employees = await this.prisma.employee.findMany({
                where: { id: { in: createMeetingDto.participantIds } },
                include: { user: true }
            });

            const attendanceData = employees.map(emp => ({
                meetingId: meeting.id,
                employeeId: emp.id,
                attended: false
            }));

            await this.prisma.meetingAttendance.createMany({
                data: attendanceData
            });

            // 3. Notify Participants
            const userIds = employees.map(e => e.userId);
            if (userIds.length > 0) {
                await this.notificationsService.createAndBroadcast(
                    userIds,
                    'MEETING_INVITE',
                    meeting.id,
                    {
                        title: 'Meeting Invitation',
                        message: `You have been invited to a meeting: ${meeting.title}`,
                        meetingTitle: meeting.title,
                        scheduledAt: meeting.scheduledAt
                    }
                );
            }
        }

        return meeting;
    }

    async findAll(date?: string) {
        let whereClause: any = {};

        if (date) {
            const searchDate = new Date(date);
            searchDate.setHours(0, 0, 0, 0);

            const nextDay = new Date(searchDate);
            nextDay.setDate(nextDay.getDate() + 1);

            whereClause.scheduledAt = {
                gte: searchDate,
                lt: nextDay
            };
        }

        return this.prisma.meeting.findMany({
            where: whereClause,
            include: {
                attendees: {
                    include: {
                        employee: {
                            select: { firstName: true, lastName: true, jobTitle: true }
                        }
                    }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        });
    }

    async findOne(id: string) {
        return this.prisma.meeting.findUnique({
            where: { id },
            include: { attendees: { include: { employee: true } } }
        });
    }
}
