import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
    cors: {
        origin: ["http://localhost:5173", "http://localhost:3000/","https://artibotserp.onrender.com"],
        credentials: true
    },
    namespace: '/communication'
})
export class CommunicationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('CommunicationGateway');

    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService
    ) { }

    // Track connected users: userId -> Set of socket Ids (multi-tab support)
    private connectedUsers: Map<string, Set<string>> = new Map();

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.query.token as string || client.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                client.disconnect();
                return;
            }
            const payload = this.jwtService.verify(token);
            client.data.user = payload;
            const userId = payload.sub;

            // Join user room
            await client.join(`user:${userId}`);
            this.logger.log(`Comm Client connected: ${userId}`);

            // Update Connected Users
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
                // First connection for this user, broadcast Online
                this.server.emit('user:status', { userId, status: 'online' });
            }
            const userSockets = this.connectedUsers.get(userId);
            if (userSockets) {
                userSockets.add(client.id);
            }


            // Join Team Rooms
            // In a real app, query "MyTeams" for this user
            const employee = await this.prisma.employee.findUnique({ where: { userId: userId } });
            if (employee) {
                const memberships = await this.prisma.teamMember.findMany({ where: { employeeId: employee.id } });
                for (const m of memberships) {
                    await client.join(`team:${m.teamId}`);
                    this.logger.log(`User ${userId} joined team:${m.teamId}`);
                }
            }
        } catch (e) {
            this.logger.error(`Connection error: ${e.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.user?.sub;
        if (userId && this.connectedUsers.has(userId)) {
            const userSockets = this.connectedUsers.get(userId);
            if (userSockets) {
                userSockets.delete(client.id);

                if (userSockets.size === 0) {
                    this.connectedUsers.delete(userId);
                    // Last connection closed, broadcast Offline
                    this.server.emit('user:status', { userId, status: 'offline' });
                }
            }
        }
    }

    @SubscribeMessage('directory:get-status')
    handleGetStatus(@ConnectedSocket() client: Socket) {
        const onlineUserIds = Array.from(this.connectedUsers.keys());
        return { onlineUsers: onlineUserIds };
    }

    @SubscribeMessage('conversation:join')
    handleJoinConversation(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
        client.join(`conversation:${data.conversationId}`);
    }

    @SubscribeMessage('conversation:leave')
    handleLeaveConversation(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
        client.leave(`conversation:${data.conversationId}`);
    }

    @SubscribeMessage('typing:start')
    handleTypingStart(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
        const userId = client.data.user.sub;
        client.to(`conversation:${data.conversationId}`).emit('typing:start', { conversationId: data.conversationId, userId });
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
        const userId = client.data.user.sub;
        client.to(`conversation:${data.conversationId}`).emit('typing:stop', { conversationId: data.conversationId, userId });
    }

    // Signaling Events
    @SubscribeMessage('call:start')
    async handleCallStart(@MessageBody() data: { targetUserId: string, conversationId: string, reason: string, priority?: string }, @ConnectedSocket() client: Socket) {
        const callerId = client.data.user.sub;
        this.logger.log(`[CommunicationGateway] Call start request from ${callerId} to ${data.targetUserId}`);
        this.logger.log(`[CommunicationGateway] Data: ${JSON.stringify(data)}`);

        // Fetch caller details for display
        const caller = await this.prisma.user.findUnique({
            where: { id: callerId },
            include: { employee: { select: { firstName: true, lastName: true } } }
        });

        const callerName = caller?.employee
            ? `${caller.employee.firstName} ${caller.employee.lastName}`
            : caller?.email || 'Unknown';

        // Create Call Session
        const session = await this.prisma.callSession.create({
            data: {
                callerUserId: callerId,
                calleeUserId: data.targetUserId,
                status: 'RINGING',
                reason: data.reason
            }
        });

        // Emit to target
        const targetRoom = `user:${data.targetUserId}`;
        const roomSize = (this.server.adapter as any).rooms.get(targetRoom)?.size || 0;
        this.logger.log(`Target room ${targetRoom} has ${roomSize} active sockets`);

        this.server.to(targetRoom).emit('call:incoming', {
            callerId,
            callerName,
            sessionId: session.id,
            conversationId: data.conversationId,
            reason: data.reason,
            priority: data.priority, // Broadcast priority
        });

        this.logger.log(`Emitting call:incoming to user:${data.targetUserId} with session ${session.id}`);

        return { sessionId: session.id };
    }

    // --- REPLACED ATOMIC ACCEPT --- 
    @SubscribeMessage('call:attempt_answer')
    async handleCallAttemptAnswer(@MessageBody() data: { callerId: string, sessionId: string, signalData: any }, @ConnectedSocket() client: Socket) {
        try {
            const userId = client.data.user.sub;
            const socketId = client.id;

            // ATOMIC LOCK: Only update if status is RINGING
            const result = await this.prisma.callSession.updateMany({
                where: {
                    id: data.sessionId,
                    status: 'RINGING'
                },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: new Date()
                }
            });

            if (result.count === 0) {
                // FAILED: Call already taken
                client.emit('call:start_error', { message: 'Call already answered on another device.' });
                client.emit('call:handled_elsewhere', { sessionId: data.sessionId, status: 'taken' });
                return;
            }

            // SUCCESS: YOU WON THE LOCK

            // 1. Tell THIS device it won
            client.emit('call:accepted_by_you', {
                sessionId: data.sessionId,
                signalData: data.signalData
            });

            // 2. Notify CALLER
            this.server.to(`user:${data.callerId}`).emit('call:accepted', {
                accepterId: userId,
                signalData: data.signalData,
                sessionId: data.sessionId
            });

            // 3. Notify ALL OTHER devices of this user
            // Use broadcast to exclude the current socket, so we don't trigger 'handled_elsewhere' on the device that just answered.
            client.broadcast.to(`user:${userId}`).emit('call:handled_elsewhere', { sessionId: data.sessionId, status: 'accepted' });

        } catch (error) {
            this.logger.error(`Error in call:attempt_answer: ${error.message}`);
        }
    }

    @SubscribeMessage('call:reject')
    async handleCallReject(@MessageBody() data: { callerId: string, sessionId: string }, @ConnectedSocket() client: Socket) {
        try {
            // Atomic check for reject too
            const result = await this.prisma.callSession.updateMany({
                where: {
                    id: data.sessionId,
                    OR: [{ status: 'RINGING' }, { status: 'IN_PROGRESS' }]
                },
                data: {
                    status: 'REJECTED',
                    endedAt: new Date()
                }
            });

            const userId = client.data.user.sub;
            const socketId = client.id;

            // Notify caller
            if (result.count > 0 || true) { // Always notify caller even if already handled, to ensure UI reset
                this.server.to(`user:${data.callerId}`).emit('call:rejected', {
                    rejecterId: userId,
                    sessionId: data.sessionId
                });
            }

            // Always tell other devices to stop ringing
            const userSockets = this.connectedUsers.get(userId);
            if (userSockets) {
                userSockets.forEach(sid => {
                    if (sid !== socketId) {
                        this.server.to(sid).emit('call:handled_elsewhere', { sessionId: data.sessionId, status: 'rejected' });
                    }
                });
            }
        } catch (error) {
            this.logger.error(`Error in call:reject: ${error.message}`);
        }
    }

    @SubscribeMessage('call:end')
    async handleCallEnd(@MessageBody() data: { targetUserId: string, sessionId: string }, @ConnectedSocket() client: Socket) {
        if (data.sessionId) {
            const session = await this.prisma.callSession.findUnique({ where: { id: data.sessionId } });
            if (session && session.startedAt) {
                const now = new Date();
                const duration = Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
                await this.prisma.callSession.update({
                    where: { id: data.sessionId },
                    data: { status: 'ENDED', endedAt: now, duration: duration }
                });
            } else {
                await this.prisma.callSession.update({
                    where: { id: data.sessionId },
                    data: { status: 'ENDED', endedAt: new Date(), duration: 0 } // No start time? 0 duration.
                });
            }
        }

        this.server.to(`user:${data.targetUserId}`).emit('call:ended', {
            enderId: client.data.user.sub
        });
    }

    @SubscribeMessage('team:send-message')
    async handleTeamMessage(@MessageBody() data: { teamId: string, content: string }, @ConnectedSocket() client: Socket) {
        // Validate membership
        const userId = client.data.user.sub;

        // 1. Save to DB
        const message = await this.prisma.teamMessage.create({
            data: {
                teamId: data.teamId,
                senderUserId: userId,
                body: data.content
            },
            include: {
                sender: { include: { employee: true } }
            }
        });

        // 2. Broadcast
        this.server.to(`team:${data.teamId}`).emit('team:new-message', {
            ...message,
            senderName: message.sender.employee
                ? `${message.sender.employee.firstName} ${message.sender.employee.lastName}`
                : message.sender.email
        });
    }

    // --- PURE WEBRTC SIGNALING ---

    @SubscribeMessage('webrtc:offer')
    handleWebRtcOffer(@MessageBody() data: { targetUserId: string, sessionId: string, offer: any }, @ConnectedSocket() client: Socket) {
        const callerId = client.data.user.sub;
        this.server.to(`user:${data.targetUserId}`).emit('webrtc:offer', {
            callerId,
            sessionId: data.sessionId,
            offer: data.offer
        });
    }

    @SubscribeMessage('webrtc:answer')
    handleWebRtcAnswer(@MessageBody() data: { targetUserId: string, sessionId: string, answer: any }, @ConnectedSocket() client: Socket) {
        const answererId = client.data.user.sub;
        this.server.to(`user:${data.targetUserId}`).emit('webrtc:answer', {
            answererId,
            sessionId: data.sessionId,
            answer: data.answer
        });
    }

    @SubscribeMessage('webrtc:ice-candidate')
    handleWebRtcIceCandidate(@MessageBody() data: { targetUserId: string, sessionId: string, candidate: any }, @ConnectedSocket() client: Socket) {
        const senderId = client.data.user.sub;
        this.server.to(`user:${data.targetUserId}`).emit('webrtc:ice-candidate', {
            senderId,
            sessionId: data.sessionId,
            candidate: data.candidate
        });
    }
}
