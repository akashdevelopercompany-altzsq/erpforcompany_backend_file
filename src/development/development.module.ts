import { Module } from '@nestjs/common';
import { DevelopmentService } from './development.service';
import { DevelopmentController } from './development.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { MulterModule } from '@nestjs/platform-express';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        PrismaModule,
        FilesModule,
        MulterModule.register(),
        NotificationsModule
    ],
    controllers: [DevelopmentController],
    providers: [DevelopmentService],
})
export class DevelopmentModule { }
