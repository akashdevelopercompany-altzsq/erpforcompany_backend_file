import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'insurance', maxCount: 1 },
        { name: 'pf', maxCount: 1 },
        { name: 'personal', maxCount: 1 },
        { name: 'educational', maxCount: 1 },
    ]))
    create(@Body() createEmployeeDto: CreateEmployeeDto, @Request() req, @UploadedFiles() files) {
        return this.employeesService.create(createEmployeeDto, req.user.role, req.user.departmentId, req.user.id, files);
    }

    @Get()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    findAll(@Request() req) {
        return this.employeesService.findAll(req.user);
    }

    @Get('me')
    @Roles(Role.EMPLOYEE)
    findMe(@Request() req) {
        return this.employeesService.findMe(req.user.id);
    }

    @Get(':id')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    findOne(@Param('id') id: string, @Request() req) {
        return this.employeesService.findOne(id, req.user);
    }

    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'insurance', maxCount: 1 },
        { name: 'pf', maxCount: 1 },
        { name: 'personal', maxCount: 1 },
        { name: 'educational', maxCount: 1 },
    ]))
    update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto, @Request() req, @UploadedFiles() files) {
        console.log('[EmployeesController] Update Payload:', updateEmployeeDto);
        console.log('[EmployeesController] Update Files:', files ? Object.keys(files) : 'No files');
        return this.employeesService.update(id, updateEmployeeDto, req.user, files);
    }

    @Delete(':id')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    remove(@Param('id') id: string, @Request() req) {
        return this.employeesService.remove(id, req.user);
    }
}
