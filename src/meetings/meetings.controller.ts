import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
    constructor(private readonly meetingsService: MeetingsService) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.HR, Role.SENIOR_MANAGER) // Allow higher roles to schedule
    create(@Body() createMeetingDto: CreateMeetingDto, @Request() req) {
        return this.meetingsService.create(createMeetingDto, req.user.id);
    }

    @Get()
    findAll(@Query('date') date: string) {
        return this.meetingsService.findAll(date);
    }
}
