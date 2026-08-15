import { Controller, Get, Request, UseGuards, Post, Body, Patch, Param } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('leave')
export class LeaveController {
    constructor(private readonly leaveService: LeaveService) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    findMe(@Request() req) {
        return this.leaveService.findMe(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('balance')
    getBalance(@Request() req) {
        return this.leaveService.getBalance(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('all')
    findAll(@Request() req) {
        return this.leaveService.findAll(req.user);
    }

    @UseGuards(JwtAuthGuard)
    @Post('apply')
    create(@Request() req, @Body() createLeaveDto: any) {
        return this.leaveService.create(createLeaveDto, req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Request() req) {
        return this.leaveService.updateStatus(id, body.status, req.user);
    }
}
