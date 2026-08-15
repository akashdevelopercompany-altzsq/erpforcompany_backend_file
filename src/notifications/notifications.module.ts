import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEventListener } from './notification.events';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [NotificationsController],
    providers: [NotificationsService, NotificationsGateway, NotificationEventListener],
    exports: [NotificationsService],
})
export class NotificationsModule { }
