import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) { }

    @Get('today')
    findToday(@Request() req) {
        console.log('AttendanceController.findToday called for user:', req.user.id);
        return this.attendanceService.findToday(req.user.id);
    }

    @Post('check-in')
    checkIn(@Request() req) {
        return this.attendanceService.checkIn(req.user.id);
    }

    @Post('check-out')
    checkOut(@Request() req) {
        return this.attendanceService.checkOut(req.user.id);
    }

    @Get('logs')
    getLogs(@Request() req) {
        return this.attendanceService.getAttendanceLogs(req.user);
    }
}
