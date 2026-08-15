import { Controller, Get, Post, Delete, Body, Patch, Param, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
    constructor(private readonly ticketsService: TicketsService) { }

    @Post()
    @Roles(Role.EMPLOYEE)
    @UseInterceptors(FileInterceptor('file'))
    create(
        @Body() createTicketDto: CreateTicketDto,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        // Mock file upload logic similar to tasks
        const attachmentUrl = file ? `/uploads/${file.filename}` : undefined;
        return this.ticketsService.create(createTicketDto, req.user.id, attachmentUrl);
    }

    @Get()
    findAll(@Request() req) {
        return this.ticketsService.findAll(req.user);
    }

    @Delete(':id')
    @Roles(Role.EMPLOYEE, Role.ADMIN, Role.SUPER_ADMIN)
    remove(@Param('id') id: string, @Request() req) {
        return this.ticketsService.remove(id, req.user);
    }

    @Patch(':id/status')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    updateStatus(@Param('id') id: string, @Body() updateTicketStatusDto: UpdateTicketStatusDto, @Request() req) {
        return this.ticketsService.updateStatus(id, updateTicketStatusDto, req.user);
    }

    @Post(':id/report')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    submitReport(
        @Param('id') id: string,
        @Body() body: { content: string; isCritical: boolean },
        @Request() req
    ) {
        return this.ticketsService.submitReport(id, body.content, body.isCritical, req.user.id);
    }

    @Get('legal/stats')
    @Roles(Role.SUPER_ADMIN)
    getLegalStats() {
        return this.ticketsService.getLegalStats();
    }

    @Get('legal/reports')
    @Roles(Role.SUPER_ADMIN)
    getLegalReports() {
        return this.ticketsService.getLegalReports();
    }
}
