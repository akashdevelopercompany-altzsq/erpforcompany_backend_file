import { Controller, Get, Post, Request, UseGuards, UseInterceptors, UploadedFile, Body, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('profile')
export class ProfileController {
    constructor(private usersService: UsersService) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@Request() req) {
        return this.usersService.me(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadDocument(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { employeeId: string; type: string; title: string }
    ) {
        if (req.user.role === Role.EMPLOYEE) {
            throw new ForbiddenException('Employees cannot upload documents');
        }

        if (!file) throw new BadRequestException('File is required');
        if (!body.employeeId) throw new BadRequestException('Target employee ID is required');

        return this.usersService.uploadDocument(
            file,
            req.user.id,
            body.employeeId,
            body.type || 'OTHER',
            body.title || file.originalname
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('dashboard')
    getDashboardStats(@Request() req) {
        return this.usersService.getDashboardStats(req.user);
    }
}
