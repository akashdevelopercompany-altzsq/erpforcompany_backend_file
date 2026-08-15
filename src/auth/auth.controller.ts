import { Body, Controller, Post, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RegisterEmployeeDto } from './dto/register-employee.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('register-super-admin')
    registerSuperAdmin(@Body() dto: RegisterSuperAdminDto) {
        return this.authService.registerSuperAdmin(dto);
    }

    @Post('register-admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'insurance', maxCount: 1 },
        { name: 'pf', maxCount: 1 },
        { name: 'personal', maxCount: 1 },
        { name: 'educational', maxCount: 1 },
        { name: 'profilePicture', maxCount: 1 },
    ]))
    registerAdmin(
        @Body() dto: RegisterAdminDto,
        @UploadedFiles() files: {
            insurance?: Express.Multer.File[],
            pf?: Express.Multer.File[],
            personal?: Express.Multer.File[],
            educational?: Express.Multer.File[],
            profilePicture?: Express.Multer.File[]
        },
        @Request() req
    ) {
        return this.authService.registerAdmin(dto, files, req.user.id);
    }

    @Post('register-employee')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'insurance', maxCount: 1 },
        { name: 'pf', maxCount: 1 },
        { name: 'personal', maxCount: 1 },
        { name: 'educational', maxCount: 1 },
        { name: 'profilePicture', maxCount: 1 },
    ]))
    registerEmployee(
        @Body() dto: RegisterEmployeeDto,
        @UploadedFiles() files: {
            insurance?: Express.Multer.File[],
            pf?: Express.Multer.File[],
            personal?: Express.Multer.File[],
            educational?: Express.Multer.File[],
            profilePicture?: Express.Multer.File[]
        },
        @Request() req
    ) {
        // If Admin, we now allow them to select department (or use their own if not selected, handled in service)
        // But to support the "Select Department" feature, we should pass undefined here so the DTO's departmentId is used.
        // However, we might want to default to their department if they didn't select one?
        // The service logic is: const departmentId = creatorDepartmentId || dto.departmentId;
        // So if we pass undefined, it uses dto.departmentId.
        return this.authService.registerEmployee(dto, undefined, files, req.user.id);
    }
}
