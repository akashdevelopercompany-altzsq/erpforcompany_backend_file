import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get('me')
    findForUser(@Request() req) {
        return this.notificationsService.findForUser(req.user.id);
    }

    @Get()
    findAll(@Request() req) {
        return this.notificationsService.findForUser(req.user.id);
    }

    @Patch(':id/read')
    markRead(@Param('id') id: string, @Request() req) {
        return this.notificationsService.markRead(id, req.user.id);
    }
}
