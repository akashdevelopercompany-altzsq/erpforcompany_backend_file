import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'sos',
})
export class SosGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('SosGateway');

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        // Extract user info from handshake auth/query if needed for room joining
        // For now, we assume client will emit a 'join' event or we handle it here
        const userId = client.handshake.query.userId;
        const role = client.handshake.query.role;
        const deptId = client.handshake.query.departmentId;

        if (role === 'SUPER_ADMIN') {
            client.join('role:SUPER_ADMIN');
        }
        if (deptId) {
            client.join(`dept:${deptId}`);
        }
        // Specific implementation might vary based on front-end auth
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    notifySosTriggered(incident: any) {
        if (this.server) {
            this.server.to('role:SUPER_ADMIN').emit('sos:triggered', incident);
        } else {
            console.warn('WebSocket Server not ready, skipping SOS notification');
        }
    }

    notifySosUpdate(incident: any) {
        if (this.server) {
            this.server.to('role:SUPER_ADMIN').emit('sos:update', incident);
        }
    }
}
