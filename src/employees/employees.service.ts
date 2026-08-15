import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Role, FileCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeesService {
    constructor(
        private prisma: PrismaService,
        private filesService: FilesService
    ) { }

    async create(createEmployeeDto: CreateEmployeeDto, creatorRole: Role, creatorDepartmentId: string | undefined, creatorId: string, files?: any) {
        const departmentId = creatorRole === Role.ADMIN ? creatorDepartmentId : undefined;

        // Manual conversion for FormData numbers and dates (Safety net)
        const dto: any = createEmployeeDto;
        if (dto.salary) dto.salary = Number(dto.salary);
        // joinDate handling if needed, though usually frontend sends ISO from date picker.
        // If string "YYYY-MM-DD", Prisma handles it if mapped to DateTime? No, need Date object.
        if (dto.joinDate && typeof dto.joinDate === 'string') dto.joinDate = new Date(dto.joinDate);

        const hashedPassword = await bcrypt.hash(createEmployeeDto.password, 10);

        return this.prisma.$transaction(async (prisma) => {
            // 1. Handle Profile Picture
            let profileImageUrl: string | undefined;
            if (files && files.profilePicture && files.profilePicture[0]) {
                const file = files.profilePicture[0];
                // Note: File is uploaded by the Creator (Admin), but belongs to the User? 
                // StoredFile.uploadedByUserId -> Creator
                const storedFile = await this.filesService.store(file, creatorId, FileCategory.PROFILE_PICTURE);
                profileImageUrl = `/files/public/${storedFile.id}`;
            }

            const user = await prisma.user.create({
                data: {
                    email: createEmployeeDto.email,
                    password: hashedPassword,
                    role: Role.EMPLOYEE,
                    departmentId: departmentId,
                    profileImage: profileImageUrl,
                }
            });

            const employee = await prisma.employee.create({
                data: {
                    userId: user.id,
                    firstName: createEmployeeDto.firstName,
                    lastName: createEmployeeDto.lastName,
                    gender: createEmployeeDto.gender,
                    phone: createEmployeeDto.phone,
                    address: createEmployeeDto.address,
                    jobTitle: createEmployeeDto.jobTitle,
                    joinDate: dto.joinDate,
                    salary: dto.salary,
                    managerId: createEmployeeDto.managerId,
                }
            });

            // 2. Handle Documents
            const docTypes = ['insurance', 'pf', 'personal', 'educational'];
            for (const type of docTypes) {
                if (files && files[type] && files[type][0]) {
                    const file = files[type][0];
                    const storedFile = await this.filesService.store(file, creatorId, 'EMPLOYEE_DOCUMENT' as any);
                    await prisma.employeeDocument.create({
                        data: {
                            employeeId: employee.id,
                            uploadedByUserId: creatorId,
                            type: type.toUpperCase() as any,
                            title: `${type.charAt(0).toUpperCase() + type.slice(1)} Document`,
                            fileUrl: `/files/public/${storedFile.id}`,
                            storedFileId: storedFile.id
                        }
                    });
                }
            }

            return employee;
        });
    }

    async findAll(user: any) {
        if (user.role === Role.SUPER_ADMIN) {
            return this.prisma.employee.findMany({ include: { user: { include: { department: true } } } });
        } else if (user.role === Role.ADMIN) {
            return this.prisma.employee.findMany({
                where: {
                    user: {
                        departmentId: user.departmentId
                    }
                },
                include: { user: { include: { department: true } } }
            });
        }
        return [];
    }

    async findOne(id: string, user: any) {
        const employee = await this.prisma.employee.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!employee) throw new NotFoundException('Employee not found');

        if (user.role === Role.ADMIN && employee.user.departmentId !== user.departmentId) {
            throw new ForbiddenException('Access denied');
        }
        if (user.role === Role.EMPLOYEE && employee.userId !== user.id) {
            throw new ForbiddenException('Access denied');
        }

        return employee;
    }

    async findMe(userId: string) {
        return this.prisma.employee.findUnique({ where: { userId }, include: { user: true } });
    }

    async update(id: string, updateEmployeeDto: UpdateEmployeeDto, user: any, files?: any) {
        const employee = await this.prisma.employee.findUnique({ where: { id }, include: { user: true } });
        if (!employee) throw new NotFoundException('Employee not found');

        // Scoping
        if (user.role === Role.ADMIN && employee.user.departmentId !== user.departmentId) {
            throw new ForbiddenException('Access denied');
        }
        if (user.role === Role.EMPLOYEE && employee.userId !== user.id) {
            throw new ForbiddenException('Access denied');
        }

        // Separate User updates (email/password/department/role) vs Employee updates
        const { email, password, departmentId, role, ...employeeData } = updateEmployeeDto as any; // Cast to any to handle extra fields if DTO is loose

        // Manual conversion for FormData numbers and dates
        if (employeeData.salary) {
            employeeData.salary = Number(employeeData.salary);
        }
        if (employeeData.joinDate) {
            employeeData.joinDate = new Date(employeeData.joinDate);
        }
        if (employeeData.dob) {
            employeeData.dob = new Date(employeeData.dob);
        }

        // Update Employee
        await this.prisma.employee.update({
            where: { id },
            data: employeeData,
        });

        // 1. Handle Profile Picture
        let profileImageUrl: string | undefined;
        if (files && files.profilePicture && files.profilePicture[0]) {
            console.log('[EmployeesService] Found profilePicture file');
            const file = files.profilePicture[0];
            const storedFile = await this.filesService.store(file, user.id, FileCategory.PROFILE_PICTURE);
            profileImageUrl = `/files/public/${storedFile.id}`;
            console.log('[EmployeesService] Generated Profile URL:', profileImageUrl);
        } else {
            console.log('[EmployeesService] No profilePicture in files');
        }

        // 2. Handle Documents (insurance, pf, personal, educational)
        const docTypes = ['insurance', 'pf', 'personal', 'educational'];
        for (const type of docTypes) {
            if (files && files[type] && files[type][0]) {
                const file = files[type][0];
                const storedFile = await this.filesService.store(file, user.id, 'EMPLOYEE_DOCUMENT' as any);
                await this.prisma.employeeDocument.create({
                    data: {
                        employeeId: id,
                        uploadedByUserId: user.id,
                        type: type.toUpperCase() as any,
                        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Document`,
                        fileUrl: `/files/public/${storedFile.id}`,
                        storedFileId: storedFile.id
                    }
                });
            }
        }

        // Update User if needed (Admin/Super Admin only for sensitive fields)
        if (email || password || departmentId || profileImageUrl || role) {
            const userData: any = {};
            if (email) userData.email = email;
            if (password) userData.password = await bcrypt.hash(password, 10);
            if (departmentId && user.role !== Role.EMPLOYEE) userData.departmentId = departmentId;
            if (role && user.role !== Role.EMPLOYEE) userData.role = role; // Allow role update if admin
            if (profileImageUrl) userData.profileImage = profileImageUrl;

            if (Object.keys(userData).length > 0) {
                await this.prisma.user.update({
                    where: { id: employee.userId },
                    data: userData,
                });
            }
        }

        return this.prisma.employee.findUnique({ where: { id } });
    }

    async remove(id: string, user: any) {
        const employee = await this.prisma.employee.findUnique({ where: { id }, include: { user: true } });
        if (!employee) throw new NotFoundException('Employee not found');

        if (user.role === Role.ADMIN && employee.user.departmentId !== user.departmentId) {
            throw new ForbiddenException('Access denied');
        }

        // Delete Employee and User with comprehensive cascade
        return this.prisma.$transaction(async (prisma) => {
            // 1. Employee Relations
            try { await prisma.leaveTokenBalance.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.leave.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.taskSubmission.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.performanceReport.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.supportTicket.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.employeeDocument.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.taskDailyReport.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.cabPassengerAssignment.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.employeeLocationLog.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.foodTokenBalance.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.foodTransaction.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.foodOrder.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.learningResource.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.meetingAttendance.deleteMany({ where: { employeeId: id } }); } catch (e) { }
            try { await prisma.teamMember.deleteMany({ where: { employeeId: id } }); } catch (e) { }

            // Tasks assigned TO this employee
            try {
                const tasksToEmployee = await prisma.task.findMany({ where: { employeeId: id }, select: { id: true } });
                const taskIds = tasksToEmployee.map(t => t.id);
                if (taskIds.length > 0) {
                    await prisma.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } });
                    await prisma.taskDailyReport.deleteMany({ where: { taskId: { in: taskIds } } });
                    await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
                }
            } catch (e) { }

            // 2. User Relations (The UserId is what usually causes 500s)
            const userId = employee.userId;

            try { await prisma.attendance.deleteMany({ where: { userId } }); } catch (e) { }
            try { await prisma.notification.deleteMany({ where: { userId } }); } catch (e) { }
            try { await prisma.announcement.deleteMany({ where: { createdByUserId: userId } }); } catch (e) { }
            try { await prisma.employeeDocument.deleteMany({ where: { uploadedByUserId: userId } }); } catch (e) { }
            try { await prisma.cabTicket.deleteMany({ where: { userId } }); } catch (e) { }

            // Chat & Communication
            try { await prisma.message.deleteMany({ where: { senderUserId: userId } }); } catch (e) { }
            try { await prisma.teamMessage.deleteMany({ where: { senderUserId: userId } }); } catch (e) { }
            try { await prisma.conversationParticipant.deleteMany({ where: { userId } }); } catch (e) { }
            try { await prisma.callSession.deleteMany({ where: { OR: [{ callerUserId: userId }, { calleeUserId: userId }] } }); } catch (e) { }

            // Projects (Update managers to null)
            try {
                await prisma.project.updateMany({ where: { seniorManagerId: userId }, data: { seniorManagerId: null } });
                await prisma.project.updateMany({ where: { projectManagerId: userId }, data: { projectManagerId: null } });
            } catch (e) { }

            // Teams created by user
            try { await prisma.team.deleteMany({ where: { createdByUserId: userId } }); } catch (e) { }

            // Tasks assigned BY user
            try {
                const tasksByUser = await prisma.task.findMany({ where: { assignedByUserId: userId }, select: { id: true } });
                const tasksByUserIds = tasksByUser.map(t => t.id);
                if (tasksByUserIds.length > 0) {
                    await prisma.taskSubmission.deleteMany({ where: { taskId: { in: tasksByUserIds } } });
                    await prisma.taskDailyReport.deleteMany({ where: { taskId: { in: tasksByUserIds } } });
                    await prisma.task.deleteMany({ where: { id: { in: tasksByUserIds } } });
                }
            } catch (e) { }

            // Nullify references in other tables
            try { await prisma.supportTicket.updateMany({ where: { resolvedByUserId: userId }, data: { resolvedByUserId: null } }); } catch (e) { }
            try { await prisma.performanceReport.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null } }); } catch (e) { }
            try { await prisma.taskSubmission.updateMany({ where: { reviewedByUserId: userId }, data: { reviewedByUserId: null } }); } catch (e) { }

            // StoredFiles (Cascading deletion is risky, but we must delete files owned by user to delete user)
            // We try to decouple first from known tables
            try {
                // Decouple from Project
                await prisma.project.updateMany({ where: { storedFile: { uploadedByUserId: userId } }, data: { storedFileId: null, fileUrl: null } });
                // Now delete the files
                await prisma.storedFile.deleteMany({ where: { uploadedByUserId: userId } });
            } catch (e) { console.log('StoredFile cleanup error (non-fatal)', e); }

            // Finally delete Employee and User
            await prisma.employee.delete({ where: { id } });
            await prisma.user.delete({ where: { id: userId } });
        });
    }
    async upsertForUser(userId: string, data: any, user: any, files?: any) {
        let employee = await this.prisma.employee.findUnique({ where: { userId } });

        if (!employee) {
            // Create default employee record if missing (e.g. for Super Admin)
            console.log(`[EmployeesService] Creating missing employee record for user ${userId}`);

            // Derive name from email if possible, else default
            const emailName = user.email.split('@')[0];

            employee = await this.prisma.employee.create({
                data: {
                    userId,
                    firstName: 'Super', // Default for initial creation
                    lastName: 'Admin',
                    gender: 'OTHER',
                    jobTitle: 'Super Admin',
                    phone: data.phone || '',
                    address: data.address || '',
                    // We will update with full data below suitable
                }
            });
        }

        return this.update(employee.id, data, user, files);
    }
}
