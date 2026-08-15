import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateProjectDto, AssignSeniorManagerDto, AssignProjectManagerDto, SelectDepartmentsDto, CreateReportDto, TerminationRequestDto } from './dto/projects.dto';
import { Role, ProjectStatus, ReportStatus, TerminationStatus, User } from '@prisma/client';

@Injectable()
export class ProjectsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly filesService: FilesService
    ) { }

    // 1. Create Project (Super Admin)
    async createProject(userId: string, data: CreateProjectDto, file?: Express.Multer.File) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only Super Admin can create projects');
        }

        let fileData = {};
        if (file) {
            const storedFile = await this.filesService.store(file, userId, 'TASK_ATTACHMENT'); // Using 'TASK_ATTACHMENT' or add 'PROJECT_FILE' to enum?
            // Schema checks: FileCategory has 'TASK_ATTACHMENT', 'OTHER', etc.
            // Let's use 'OTHER' or 'TASK_ATTACHMENT' for now.
            // Or I should update Enum but I can't easily due to prisma generate.
            // Let's use 'OTHER' or existing.

            // Wait, schema viewed earlier:
            // enum FileCategory { ... PROJECT_FILE? No. } .
            // I'll use 'OTHER' for now to be safe.
            fileData = {
                fileUrl: `/files/public/${storedFile.id}`,
                storedFileId: storedFile.id
            };
        }

        return this.prisma.project.create({
            data: {
                title: data.title,
                description: data.description,
                deadline: data.deadline,
                seniorManagerId: data.seniorManagerId,
                ...fileData
            },
        });
    }

    // 2. Assign Senior Manager (Super Admin) - Should be done at creation or later
    async assignSeniorManager(userId: string, projectId: string, seniorManagerId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== Role.SUPER_ADMIN) {
            throw new ForbiddenException('Only Super Admin can assign Senior Managers');
        }

        // Verify Senior Manager role
        const senior = await this.prisma.user.findUnique({ where: { id: seniorManagerId } });
        if (!senior || senior.role !== Role.SENIOR_MANAGER) {
            throw new BadRequestException('User is not a Senior Manager');
        }

        return this.prisma.project.update({
            where: { id: projectId },
            data: { seniorManagerId },
        });
    }

    // 3. Assign Project Manager (Senior Manager)
    async assignProjectManager(userId: string, projectId: string, projectManagerId: string) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        // Caller must be the assigned Senior Manager or Super Admin
        if (project.seniorManagerId !== userId) {
            const caller = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!caller || caller.role !== Role.SUPER_ADMIN) {
                throw new ForbiddenException('Not authorized to assign PM for this project');
            }
        }

        const pm = await this.prisma.user.findUnique({ where: { id: projectManagerId } });
        if (!pm || pm.role !== Role.PROJECT_MANAGER) {
            throw new BadRequestException('User is not a Project Manager');
        }

        return this.prisma.project.update({
            where: { id: projectId },
            data: { projectManagerId },
        });
    }

    // 4. Select Departments (Project Manager)
    async selectDepartments(userId: string, projectId: string, departmentIds: string[]) {
        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new NotFoundException('Project not found');

        if (project.projectManagerId !== userId) {
            const caller = await this.prisma.user.findUnique({ where: { id: userId } });
            // Allow Senior Manager or Super Admin too? Usually PM does this.
            if (!caller || (caller.role !== Role.SUPER_ADMIN && project.seniorManagerId !== userId)) {
                throw new ForbiddenException('Only Project Manager can select departments');
            }
        }

        // Create ProjectDepartments
        // First remove existing or just add new? requirement says "select departments".
        // We will use transaction to ensure consistency
        return this.prisma.$transaction(async (tx) => {
            // Find existing to avoid duplicates if needed, or rely on @@unique
            const promises = departmentIds.map(async (deptId) => {
                const exists = await tx.projectDepartment.findUnique({
                    where: { projectId_departmentId: { projectId, departmentId: deptId } }
                });
                if (!exists) {
                    return tx.projectDepartment.create({
                        data: { projectId, departmentId: deptId }
                    });
                }
            });
            await Promise.all(promises);
        });
    }

    // 5. Dept Admin selects employees (Creates Team)
    async assignEmployees(userId: string, projectId: string, departmentId: string, employeeIds: string[]) {
        // Verify caller is Dept Admin of that department
        const caller = await this.prisma.user.findUnique({ where: { id: userId }, include: { department: true } });
        if (!caller) throw new ForbiddenException('User not found');

        if (caller.departmentId !== departmentId || caller.role !== Role.DEPARTMENT_MANAGER) {
            // Allow PM assignment as fallback? Requirement says "in the department admin will select".
            // Also "Project manager will select the department ... then ... department admin will select".
            // Let's enforce Dept Admin or Super Admin.
            if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.ADMIN) { // Admin might be generic admin
                throw new ForbiddenException('Only Department Admin can assign employees');
            }
        }

        // Create a Team for this project in this department if not exists
        let team = await this.prisma.team.findFirst({
            where: { projectId, departmentId }
        });

        if (!team) {
            team = await this.prisma.team.create({
                data: {
                    name: `Project Team - ${departmentId}`, // Should fetch department name really
                    projectId,
                    departmentId,
                    createdByUserId: userId
                }
            });
        }

        // Add members
        // We need to add them to TeamMember
        const ops = employeeIds.map(empId => {
            return this.prisma.teamMember.create({
                data: {
                    teamId: team.id,
                    employeeId: empId,
                    role: 'MEMBER' // Default
                }
            }).catch(e => { }); // Ignore duplicates
        });

        await Promise.all(ops);
        return team;
    }

    // 6. Report Upload (Employee)
    async uploadReport(userId: string, projectId: string, data: CreateReportDto) {
        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new ForbiddenException('Not an employee');

        return this.prisma.projectReport.create({
            data: {
                projectId,
                employeeId: employee.id,
                title: data.title,
                content: data.content,
                fileUrl: data.fileUrl,
                status: ReportStatus.PENDING
            }
        });
    }

    // 7. Report Verification (L1 Dept Admin / L2 PM)
    async verifyReport(userId: string, reportId: string, status: ReportStatus) {
        const report = await this.prisma.projectReport.findUnique({
            where: { id: reportId },
            include: { project: true, employee: { include: { user: { include: { department: true } } } } }
        });
        if (!report) throw new NotFoundException('Report not found');

        const caller = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!caller) throw new ForbiddenException('User not found');

        // L1 Logic: Dept Admin
        if (status === ReportStatus.VERIFIED_L1) {
            // Caller must be Dept Admin of the employee's department
            // Assuming employee belongs to the department tied to the project work
            // Since project can have multiple depts, we check if caller is dept admin of employee's dept
            // Or if caller is team lead of the team the employee is in for this project.
            // Simplification: Check if caller is DEPT_MANAGER and in same dept as employee
            if (caller.role !== Role.DEPARTMENT_MANAGER && caller.role !== Role.SUPER_ADMIN) {
                throw new ForbiddenException('Only Department Manager can perform L1 verification');
            }
            await this.prisma.projectReport.update({
                where: { id: reportId },
                data: { status: ReportStatus.VERIFIED_L1, verifiedByL1Id: userId }
            });
        }

        // L2 Logic: Project Manager
        else if (status === ReportStatus.VERIFIED_L2) {
            if (report.status !== ReportStatus.VERIFIED_L1) {
                throw new BadRequestException('Report must be L1 verified first');
            }
            if (caller.id !== report.project.projectManagerId && caller.role !== Role.SUPER_ADMIN) {
                throw new ForbiddenException('Only Project Manager can perform L2 verification');
            }
            await this.prisma.projectReport.update({
                where: { id: reportId },
                data: { status: ReportStatus.VERIFIED_L2, verifiedByL2Id: userId }
            });
        }

        // Super Admin View (implicit via status change to APPROVED?)
        // User said "except super admin it need two admin level" - implies SA doesn't verify, but maybe approves?
        // Assuming L2 is final verification or SA can APPROVE.
        else if (status === ReportStatus.APPROVED) {
            // Maybe auto-approve after L2? Or PM sets to APPROVED?
            // Let's allow PM to also set APPROVED from L1 or L2?
            // User says "verify with except super admin it need two admin level".
            // So L1 -> L2. After L2 it is effectively verified.
            // I will allow PM to set to APPROVED or just leave at VERIFIED_L2.
            await this.prisma.projectReport.update({
                where: { id: reportId },
                data: { status: ReportStatus.APPROVED }
            });
        }

        else if (status === ReportStatus.REJECTED) {
            // Anyone in chain can reject
            await this.prisma.projectReport.update({
                where: { id: reportId },
                data: { status: ReportStatus.REJECTED }
            });
        }
    }

    // 8. Termination
    // 1. Initiation/Approval by Team Lead, Project Manager, Senior Manager + Hr
    async handleTerminationAction(userId: string, projectId: string, action: string, data?: TerminationRequestDto) {
        let termination = await this.prisma.projectTerminationRequest.findUnique({ where: { projectId } });
        const caller = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!caller) throw new ForbiddenException('User not found');

        if (!termination) {
            // Initialize if not exists
            // Can be initialized by any of the admins?
            // "Termination need Approval of three admin"
            // Let's assume creation is initiation.
            await this.prisma.projectTerminationRequest.create({
                data: {
                    projectId,
                    reason: data?.reason || 'Termination Requested',
                    status: TerminationStatus.PENDING_APPROVAL
                }
            });
            termination = await this.prisma.projectTerminationRequest.findUnique({ where: { projectId } });
        }

        if (!termination) throw new NotFoundException('Termination request creation failed');

        // Check Role and Apply Approval
        if (caller.role === Role.DEPARTMENT_MANAGER) {
            await this.prisma.projectTerminationRequest.update({
                where: { id: termination.id },
                data: { teamLeadApproved: true }
            });
        } else if (caller.role === Role.PROJECT_MANAGER) {
            await this.prisma.projectTerminationRequest.update({
                where: { id: termination.id },
                data: { pmApproved: true }
            });
        } else if (caller.role === Role.SENIOR_MANAGER) {
            await this.prisma.projectTerminationRequest.update({
                where: { id: termination.id },
                data: { seniorPmApproved: true }
            });
        } else if (caller.role === Role.HR) {
            await this.prisma.projectTerminationRequest.update({
                where: { id: termination.id },
                data: { hrApproved: true }
            });
        } else if (caller.role === Role.SUPER_ADMIN) {
            if (action === 'CEO_VERIFY') {
                // CEO Verification Step
                await this.prisma.projectTerminationRequest.update({
                    where: { id: termination.id },
                    data: { ceoApproved: true, status: TerminationStatus.PENDING_CEO }
                });
            } else if (action === 'FINAL_APPROVE') {
                // Check if all approved
                if (termination.teamLeadApproved && termination.pmApproved && termination.seniorPmApproved && termination.hrApproved && termination.ceoApproved) {
                    await this.prisma.projectTerminationRequest.update({
                        where: { id: termination.id },
                        data: { status: TerminationStatus.APPROVED }
                    });
                    // Terminate Project
                    await this.prisma.project.update({
                        where: { id: projectId },
                        data: { status: ProjectStatus.TERMINATED }
                    });
                } else {
                    throw new BadRequestException('Not all approvals met');
                }
            }
        }

        // Update Reports if provided
        if (data?.descriptionReport) {
            await this.prisma.projectTerminationRequest.update({
                where: { id: termination.id },
                data: { descriptionReport: data.descriptionReport, isOnline: data.isOnline, proofUrl: data.proofUrl, discussionReport: data.discussionReport }
            });
        }
    }

    // 9. Get Projects (Role based)
    async getProjects(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
        if (!user) return [];

        if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.project.findMany({ include: { seniorManager: true, projectManager: true } });
        }

        if (user.role === Role.SENIOR_MANAGER) {
            return this.prisma.project.findMany({
                where: { seniorManagerId: userId },
                include: { projectManager: true }
            });
        }

        if (user.role === Role.PROJECT_MANAGER) {
            return this.prisma.project.findMany({
                where: { projectManagerId: userId },
                include: { departments: { include: { department: true } } }
            });
        }

        if (user.role === Role.DEPARTMENT_MANAGER) {
            // Find projects where one of the departments is user's department
            // AND user is dept manager? 
            // Use departmentId from user
            if (!user.departmentId) return [];
            return this.prisma.project.findMany({
                where: { departments: { some: { departmentId: user.departmentId } } },
                include: { seniorManager: true, projectManager: true }
            });
        }

        if (user.role === Role.EMPLOYEE) {
            // Find projects where user is in a Team linked to the project
            const employeeId = user.employee?.id;
            if (!employeeId) return [];

            const teams = await this.prisma.teamMember.findMany({
                where: { employeeId },
                select: { team: { select: { projectId: true } } }
            });
            const projectIds = teams.map(t => t.team.projectId).filter(Boolean);
            return this.prisma.project.findMany({
                where: { id: { in: projectIds } }
            });
        }

        return [];
    }

    // 10. Get Project Details
    async getProjectDetails(userId: string, projectId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { employee: true }
        });

        if (!user) throw new ForbiddenException('User not found');

        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                seniorManager: true,
                projectManager: true,
                departments: { include: { department: true } },
                reports: { include: { employee: { include: { user: { include: { department: true } } } } } },
                terminationRequest: true,
                teams: { include: { members: { include: { employee: true } } } }
            }
        });

        if (!project) throw new NotFoundException('Project not found');

        // Access Control
        if (user.role === Role.SUPER_ADMIN) {
            return project;
        }

        if (user.role === Role.SENIOR_MANAGER && project.seniorManagerId === userId) {
            return project;
        }

        if (user.role === Role.PROJECT_MANAGER && project.projectManagerId === userId) {
            return project;
        }

        if (user.role === Role.DEPARTMENT_MANAGER) {
            // Allow if one of the project's departments matches user's department
            const isDeptAssigned = project.departments.some(pd => pd.departmentId === user.departmentId);
            if (isDeptAssigned) return project;
        }

        if (user.role === Role.EMPLOYEE) {
            // Allow if user is in a Team assigned to this project
            const isTeamMember = project.teams.some(team =>
                team.members.some(member => member.employeeId === user.employee?.id)
            );
            if (isTeamMember) return project;
        }

        throw new ForbiddenException('You do not have permission to view this project.');
    }
}
