import { Module } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CommunicationController } from './communication.controller';
import { CommunicationGateway } from './communication.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [
        PrismaModule,
        NotificationsModule,
        AuthModule,
        FilesModule,
    ],
    controllers: [CommunicationController],
    providers: [CommunicationService, CommunicationGateway],
    exports: [CommunicationService]
})
export class CommunicationModule { }
