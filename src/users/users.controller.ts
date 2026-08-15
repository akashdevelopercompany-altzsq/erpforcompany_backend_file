import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
    constructor(private usersService: UsersService) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Request() req) {
        return this.usersService.me(req.user.id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SENIOR_MANAGER, Role.DEPARTMENT_MANAGER)
    @Get()
    findAll(@Request() req) {
        return this.usersService.findAll(req.user);
    }
}
