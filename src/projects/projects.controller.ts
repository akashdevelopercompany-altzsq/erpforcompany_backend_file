import { Controller, Post, Patch, Put, Body, Param, UseGuards, Request, Get, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; // Corrected path
import { CreateProjectDto, AssignSeniorManagerDto, AssignProjectManagerDto, SelectDepartmentsDto, CreateReportDto, TerminationRequestDto } from './dto/projects.dto';
// import { ReportStatus } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    createProject(@Request() req, @Body() dto: CreateProjectDto, @UploadedFile() file?: Express.Multer.File) {
        return this.projectsService.createProject(req.user.id, dto, file);
    }

    @Get()
    getProjects(@Request() req) {
        return this.projectsService.getProjects(req.user.id);
    }

    @Get(':id')
    getProjectDetails(@Request() req, @Param('id') projectId: string) {
        return this.projectsService.getProjectDetails(req.user.id, projectId);
    }

    @Put(':id/senior-manager')
    assignSeniorManager(@Request() req, @Param('id') projectId: string, @Body() dto: AssignSeniorManagerDto) {
        return this.projectsService.assignSeniorManager(req.user.id, projectId, dto.seniorManagerId);
    }

    @Put(':id/project-manager')
    assignProjectManager(@Request() req, @Param('id') projectId: string, @Body() dto: AssignProjectManagerDto) {
        return this.projectsService.assignProjectManager(req.user.id, projectId, dto.projectManagerId);
    }

    @Post(':id/departments')
    selectDepartments(@Request() req, @Param('id') projectId: string, @Body() dto: SelectDepartmentsDto) {
        return this.projectsService.selectDepartments(req.user.id, projectId, dto.departmentIds);
    }

    @Post(':id/departments/:deptId/employees')
    assignEmployees(@Request() req, @Param('id') projectId: string, @Param('deptId') departmentId: string, @Body() body: { employeeIds: string[] }) {
        return this.projectsService.assignEmployees(req.user.id, projectId, departmentId, body.employeeIds);
    }

    @Post(':id/reports')
    uploadReport(@Request() req, @Param('id') projectId: string, @Body() dto: CreateReportDto) {
        return this.projectsService.uploadReport(req.user.id, projectId, dto);
    }

    @Patch('reports/:reportId/verify')
    verifyReport(@Request() req, @Param('reportId') reportId: string, @Body() body: { status: string }) {
        return this.projectsService.verifyReport(req.user.id, reportId, body.status as any);
    }

    @Post(':id/termination')
    handleTermination(@Request() req, @Param('id') projectId: string, @Body() body: { action: string, data?: TerminationRequestDto }) {
        // action: 'INITIATE', 'CEO_VERIFY', 'FINAL_APPROVE' or just implicit by role?
        // Service uses handleTerminationAction(userId, projectId, action, data)
        // I'll pass action in body for clarity or derive from status?
        // Let's assume body.action is passed.
        return this.projectsService.handleTerminationAction(req.user.id, projectId, body.action, body.data);
    }
}
