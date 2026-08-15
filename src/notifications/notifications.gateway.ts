import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('NotificationsGateway');

    constructor(private jwtService: JwtService) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.query.token as string || client.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                this.logger.warn(`Connection attempt without token from ${client.id}`);
                client.disconnect();
                return;
            }

            // Verify token - Assuming JWT secret is available via ConfigService or env, but JwtService usually has it configured in module
            const payload = this.jwtService.verify(token);

            // { userId, role, departmentId }
            const { sub: userId, role, departmentId } = payload;

            // Store user info in socket
            client.data.user = { userId, role, departmentId };

            // Join rooms
            await client.join(`user:${userId}`);
            if (role) await client.join(`role:${role}`);
            if (departmentId) await client.join(`dept:${departmentId}`);

            this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

        } catch (e) {
            this.logger.error(`Connection unauthorized: ${e.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @OnEvent('notification.send')
    handleNotificationSend(payload: { recipients: string[], type: string, referenceId?: string, payload?: any }) {
        this.logger.log(`Broadcasting notification: ${payload.type} to ${payload.recipients.length} users`);
        payload.recipients.forEach(userId => {
            this.server.to(`user:${userId}`).emit('notification', {
                id: 'temp-' + Date.now(), // ID not available from emit unless we change service to return it, passing simplified object for now or we should pass full object
                type: payload.type,
                title: payload.payload?.title,
                body: payload.payload?.message, // Mapping 'message' to 'body' as per context
                referenceId: payload.referenceId,
                payload: payload.payload,
                read: false,
                createdAt: new Date().toISOString()
            });
        });
    }
}
