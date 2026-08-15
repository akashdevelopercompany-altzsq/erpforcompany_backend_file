
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, ParseUUIDPipe } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('teams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    create(@Body() createTeamDto: any, @Req() req: any) {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userDepartmentId = req.user.departmentId; // Assuming embedded in JWT or fetched
        return this.teamsService.create(createTeamDto, userId, userRole, userDepartmentId);
    }

    @Get('my')
    findAllMyTeams(@Req() req: any) {
        return this.teamsService.findAllByUserId(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.teamsService.findOne(id, req.user);
    }

    @Post(':id/members')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    addMember(@Param('id', ParseUUIDPipe) id: string, @Body() body: { employeeId: string }, @Req() req: any) {
        return this.teamsService.addMember(id, body.employeeId, req.user);
    }

    @Delete(':id/members/:memberId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    removeMember(@Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Req() req: any) {
        return this.teamsService.removeMember(id, memberId, req.user);
    }

    @Get(':id/messages')
    findMessages(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
        return this.teamsService.findMessages(id, req.user.id);
    }

    @Post(':id/messages')
    sendMessage(@Param('id', ParseUUIDPipe) id: string, @Body() body: { content: string, attachmentUrl?: string }, @Req() req: any) {
        return this.teamsService.sendMessage(id, req.user.id, body.content, body.attachmentUrl);
    }
}
