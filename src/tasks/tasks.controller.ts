import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { TasksService } from './tasks.service';
import { FilesService } from '../files/files.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, FileCategory } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
    constructor(
        private readonly tasksService: TasksService,
        private readonly filesService: FilesService
    ) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @Body() createTaskDto: CreateTaskDto,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl: string | undefined;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id, FileCategory.TASK_ATTACHMENT);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
            createTaskDto.fileUrl = fileUrl;
            createTaskDto.storedFileId = storedFileId;
        }

        return this.tasksService.create(createTaskDto, req.user);
    }

    @Get()
    findAll(@Request() req) {
        return this.tasksService.findAll(req.user);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() updateTaskStatusDto: UpdateTaskStatusDto, @Request() req) {
        return this.tasksService.updateStatus(id, updateTaskStatusDto, req.user);
    }

    @Post(':id/submit')
    @Roles(Role.EMPLOYEE)
    @UseInterceptors(FileInterceptor('file'))
    async submitTask(
        @Param('id') id: string,
        @Body() createSubmissionDto: CreateSubmissionDto,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl: string | undefined;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id, FileCategory.TASK_SUBMISSION);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
        }

        return this.tasksService.submitTask(id, createSubmissionDto, req.user.id, fileUrl, storedFileId);
    }

    @Post(':id/daily-report')
    @Roles(Role.EMPLOYEE)
    createDailyReport(
        @Param('id') id: string,
        @Body() body: { progress: number; hoursSpent: number; description: string },
        @Request() req
    ) {
        return this.tasksService.createDailyReport(id, req.user.id, body);
    }

    @Patch('submissions/:id/review')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    reviewTask(
        @Param('id') id: string,
        @Body() body: { status: string; reviewComment: string },
        @Request() req
    ) {
        return this.tasksService.reviewTask(id, body.status, body.reviewComment, req.user);
    }
}
