import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Get()
    findAll() {
        return this.departmentsService.findAll();
    }

    @Post()
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    create(@Body() createDepartmentDto: CreateDepartmentDto) {
        return this.departmentsService.create(createDepartmentDto);
    }
}
