import { Controller, Get, Post, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from '../files/files.service';
import { FinanceService } from './finance.service';
import { CreateFinanceReportDto } from './dto/create-finance-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { Express } from 'express';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
    constructor(
        private readonly financeService: FinanceService,
        private readonly filesService: FilesService
    ) { }

    @Post('reports')
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async createReport(
        @Request() req,
        @Body() createFinanceReportDto: CreateFinanceReportDto,
        @UploadedFile() file: Express.Multer.File
    ) {
        // Strict check: Only Finance Department Admin can upload
        const user = req.user;

        // Handle file upload
        let fileUrl = createFinanceReportDto.fileUrl;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, user.id);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
            createFinanceReportDto.fileUrl = fileUrl;
        }

        // Let's use the service to verify eligibility
        return this.financeService.createReport(user.id, createFinanceReportDto, storedFileId);
    }

    @Get('reports')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    findAllReports() {
        // Optionally filter: If Admin, only return if they are Finance Dept?
        // For now, allowing all Admins to read reports is probably okay, or we can restrict in Service.
        return this.financeService.findAllReports();
    }
}
