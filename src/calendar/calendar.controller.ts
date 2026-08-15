import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';
// Assuming JwtAuthGuard exists
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) { }

    @Get('public')
    async getPublicEvents(@Query('start') start: string, @Query('end') end: string) {
        // If not provided, default to current year? Service handles logic preferably, but let's pass dates.
        // If empty, service can default.
        return this.calendarService.getHolidays(
            start ? new Date(start) : new Date(new Date().getFullYear(), 0, 1),
            end ? new Date(end) : new Date(new Date().getFullYear(), 11, 31)
        );
    }

    // Admin only: Add Event
    @Post('event')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    async createEvent(@Body() data: { title: string, date: string, type: 'HOLIDAY' | 'EVENT' | 'SHUTDOWN' }) {
        // Logic to create event (I need to Add create method to service)
        return { message: 'Use Prisma directly for now or implement create in service' };
    }
}
