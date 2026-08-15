import { Controller, Get, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile, Delete, Patch, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AnnouncementsService } from './announcements.service';
import { FilesService } from '../files/files.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, FileCategory } from '@prisma/client';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
    constructor(
        private readonly announcementsService: AnnouncementsService,
        private readonly filesService: FilesService
    ) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async create(@Body() createAnnouncementDto: CreateAnnouncementDto, @Request() req, @UploadedFile() file: Express.Multer.File) {
        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id, FileCategory.ANNOUNCEMENT);
            createAnnouncementDto.mediaUrl = `/files/public/${storedFile.id}`;

            if (file.mimetype.startsWith('image/')) {
                createAnnouncementDto.mediaType = 'IMAGE';
            } else if (file.mimetype.startsWith('video/')) {
                createAnnouncementDto.mediaType = 'VIDEO';
            } else {
                createAnnouncementDto.mediaType = 'DOCUMENT';
            }
        }
        return this.announcementsService.create(createAnnouncementDto, req.user);
    }

    @Get()
    async findAll(@Request() req) {
        try {
            return await this.announcementsService.findAll(req.user);
        } catch (error) {
            const fs = require('fs');
            fs.appendFileSync('error.log', `[Announcements Error] ${new Date().toISOString()}: ${error.stack || error}\n`);
            throw error;
        }
    }
    @Delete(':id')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.announcementsService.remove(id);
    }

    @Patch(':id')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async update(@Param('id') id: string, @Body() updateAnnouncementDto: any, @Request() req, @UploadedFile() file: Express.Multer.File) {
        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id, FileCategory.ANNOUNCEMENT);
            updateAnnouncementDto.mediaUrl = `/files/public/${storedFile.id}`;

            if (file.mimetype.startsWith('image/')) {
                updateAnnouncementDto.mediaType = 'IMAGE';
            } else if (file.mimetype.startsWith('video/')) {
                updateAnnouncementDto.mediaType = 'VIDEO';
            } else {
                updateAnnouncementDto.mediaType = 'DOCUMENT';
            }
        }
        return this.announcementsService.update(id, updateAnnouncementDto);
    }
}
