import { Controller, Get, Patch, Body, Param, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UsersService } from '../users/users.service';
import { EmployeesService } from '../employees/employees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
    constructor(
        private usersService: UsersService,
        private employeesService: EmployeesService
    ) { }

    @Get('me')
    async getMe(@Request() req) {
        return this.usersService.me(req.user.id);
    }

    @Get('dashboard')
    async getDashboard(@Request() req) {
        return this.usersService.getDashboardStats(req.user);
    }

    @Get(':id')
    async getOne(@Request() req, @Param('id') id: string) {
        // 'me' and 'dashboard' are handled by preceding decorators
        return this.usersService.me(id);
    }

    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'insurance', maxCount: 1 },
        { name: 'pf', maxCount: 1 },
        { name: 'personal', maxCount: 1 },
        { name: 'educational', maxCount: 1 },
    ]))
    async updateProfile(@Request() req, @Param('id') id: string, @Body() body: any, @UploadedFiles() files) {
        const targetUserId = id;
        const requestingUser = req.user;

        // Allow Self Update OR Admin/SuperAdmin Update
        if (requestingUser.id === targetUserId || requestingUser.role === Role.ADMIN || requestingUser.role === Role.SUPER_ADMIN) {
            // Use upsertForUser to handle cases where employee record doesn't exist (e.g. Super Admin)
            return this.employeesService.upsertForUser(targetUserId, body, requestingUser, files);
        }

        throw new ForbiddenException('You can only update your own profile');
    }
}
