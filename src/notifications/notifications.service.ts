import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2
    ) { }

    async createAndBroadcast(usersIds: string[], type: string, referenceId?: string, payload?: any) {
        // 1. Create notifications in DB
        const data = usersIds.map(userId => ({
            userId,
            type,
            referenceId,
            payload,
            title: payload?.title || type, // Fallback for backward compatibility if title is still required in some views
            body: payload?.message || '',
        }));

        await this.prisma.notification.createMany({
            data,
        });

        // 2. Emit event for real-time broadcast
        this.eventEmitter.emit('notification.send', {
            recipients: usersIds,
            type,
            referenceId,
            payload,
        });

        return { count: usersIds.length };
    }

    async findForUser(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit to recent 50
        });
    }

    async markRead(id: string, userId: string) {
        const notification = await this.prisma.notification.findUnique({ where: { id } });
        if (!notification) throw new NotFoundException('Notification not found');

        if (notification.userId !== userId) {
            console.error(`403 Error: Notification User ID (${notification.userId}) does not match Request User ID (${userId})`);
            throw new ForbiddenException('Access denied');
        }

        return this.prisma.notification.update({
            where: { id },
            data: { read: true },
        });
    }
}
