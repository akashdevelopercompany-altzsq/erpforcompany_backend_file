import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [
        MulterModule.register(),
        NotificationsModule,
        PrismaModule,
        FilesModule,
    ],
    controllers: [TasksController],
    providers: [TasksService],
})
export class TasksModule { }
