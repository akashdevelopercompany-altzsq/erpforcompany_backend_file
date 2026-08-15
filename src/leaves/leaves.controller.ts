import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavesController {
    constructor(private readonly leavesService: LeavesService) { }

    @Post()
    @Roles(Role.EMPLOYEE)
    requestLeave(@Body() createLeaveDto: CreateLeaveDto, @Request() req) {
        return this.leavesService.requestLeave(req.user.id, createLeaveDto);
    }

    @Get('me')
    @Roles(Role.EMPLOYEE)
    listMine(@Request() req) {
        return this.leavesService.listMine(req.user.id);
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    listForAdmin(@Request() req) {
        return this.leavesService.listForAdmin(req.user);
    }

    @Patch(':id/status')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    updateStatus(@Param('id') id: string, @Body() updateLeaveStatusDto: UpdateLeaveStatusDto, @Request() req) {
        return this.leavesService.updateStatus(id, updateLeaveStatusDto, req.user);
    }
}
