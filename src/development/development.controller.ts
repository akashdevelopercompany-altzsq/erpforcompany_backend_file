import { Controller, Get, Post, Body, Param, Put, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { DevelopmentService } from './development.service';
import { FilesService } from '../files/files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('development')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevelopmentController {
    constructor(
        private readonly developmentService: DevelopmentService,
        private readonly filesService: FilesService
    ) { }

    @Get('my-resources')
    findAll(@Request() req) {
        return this.developmentService.findAll(req.user);
    }

    @Post('request')
    @Roles('EMPLOYEE')
    create(@Request() req, @Body() dto: any) {
        return this.developmentService.create(req.user, dto);
    }

    @Post('assign')
    @Roles('ADMIN', 'SUPER_ADMIN')
    assign(@Request() req, @Body() dto: any) {
        return this.developmentService.assign(req.user, dto);
    }

    @Get('requests')
    @Roles('ADMIN', 'SUPER_ADMIN')
    findAllRequests(@Request() req, @Query('status') status: string) {
        return this.developmentService.findAll(req.user, status);
    }

    @Put(':id/status')
    @Roles('ADMIN', 'SUPER_ADMIN')
    updateStatus(@Param('id') id: string, @Body() body: { status: string; adminComment?: string }) {
        return this.developmentService.updateStatus(id, body.status, body.adminComment);
    }

    @Post(':id/certificate')
    @Roles('EMPLOYEE')
    @UseInterceptors(FileInterceptor('file'))
    async uploadCertificate(
        @Param('id') id: string,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (!file) throw new BadRequestException('File is required');

        const storedFile = await this.filesService.store(file, req.user.id);
        const storedFileId = storedFile.id;
        const fileUrl = `/files/${storedFile.id}`;

        return this.developmentService.uploadCertificate(id, fileUrl, storedFileId);
    }
    @Put(':id/payment-url')
    @Roles('EMPLOYEE')
    async submitPaymentUrl(@Param('id') id: string, @Body() body: { paymentUrl: string }) {
        if (!body.paymentUrl) throw new BadRequestException('Payment URL is required');
        return this.developmentService.submitPaymentUrl(id, body.paymentUrl);
    }

    @Put(':id/pay')
    @Roles('ADMIN', 'SUPER_ADMIN')
    async markAsPaid(@Param('id') id: string) {
        return this.developmentService.markAsPaid(id);
    }
}
