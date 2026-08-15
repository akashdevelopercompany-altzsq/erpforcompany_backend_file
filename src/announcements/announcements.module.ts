import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { PrismaService } from '../prisma.service';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [FilesModule],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService, PrismaService],
})
export class AnnouncementsModule { }
