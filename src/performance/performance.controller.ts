import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PerformanceService } from './performance.service';
import { FilesService } from '../files/files.service';
import { CreatePerformanceReportDto } from './dto/create-performance-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {
    constructor(
        private readonly performanceService: PerformanceService,
        private readonly filesService: FilesService
    ) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE)
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @Body() createPerformanceReportDto: CreatePerformanceReportDto,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl = createPerformanceReportDto.fileUrl; // Fallback or existing logic
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
            createPerformanceReportDto.fileUrl = fileUrl;
        }
        return this.performanceService.create(createPerformanceReportDto, req.user, storedFileId);
    }

    @Patch(':id')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    update(@Param('id') id: string, @Body() body: any, @Request() req) {
        return this.performanceService.update(id, body, req.user);
    }

    @Get('analysis')
    getAnalysis(@Request() req, @Query('period') period: 'WEEKLY' | 'MONTHLY' | 'YEARLY') {
        return this.performanceService.getAnalysis(req.user, period || 'MONTHLY');
    }

    @Get()
    findAll(@Request() req) {
        return this.performanceService.findAll(req.user);
    }
}
