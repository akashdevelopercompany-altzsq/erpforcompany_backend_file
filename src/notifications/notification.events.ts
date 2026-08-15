import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationEventListener {
    private logger = new Logger('NotificationEventListener');

    constructor(private readonly gateway: NotificationsGateway) { }

    @OnEvent('notification.send')
    handleNotificationSendEvent(payload: {
        recipients: string[];
        type: string;
        referenceId?: string;
        payload?: any;
        createdAt?: Date;
    }) {
        this.logger.log(`Broadcasting notification '${payload.type}' to ${payload.recipients.length} recipients`);

        // Broadcast to each recipient
        payload.recipients.forEach(userId => {
            this.gateway.server.to(`user:${userId}`).emit('notification', {
                type: payload.type,
                referenceId: payload.referenceId,
                payload: payload.payload,
                createdAt: payload.createdAt || new Date(),
            });
        });
    }
}
