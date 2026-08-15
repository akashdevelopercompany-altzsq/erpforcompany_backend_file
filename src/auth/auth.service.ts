import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import { Role, DocumentType } from '@prisma/client';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterEmployeeDto } from './dto/register-employee.dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto) {
        console.log('Login attempt for:', loginDto.email);
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
            include: {
                employee: true,
                department: true
            }
        });

        if (!user) {
            console.log('User not found');
            throw new UnauthorizedException('User not found');
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        console.log('Password valid:', isPasswordValid);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Password invalid');
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                departmentId: user.departmentId,
                employee: user.employee,
                department: user.department
            }
        };
    }

    async registerSuperAdmin(dto: RegisterSuperAdminDto) {
        // Check if any super admin exists (optional, but good practice to limit to one or few)
        // For now, just create.
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Create Department first if not exists or just create new one
        // Assuming unique department name for simplicity
        let department = await this.prisma.department.findUnique({ where: { name: dto.departmentName } });
        if (!department) {
            department = await this.prisma.department.create({ data: { name: dto.departmentName } });
        }

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
                departmentId: department?.id,
            },
        });

        // Create Employee profile for Super Admin
        await this.prisma.employee.create({
            data: {
                userId: user.id,
                firstName: dto.firstName,
                lastName: dto.lastName,
                gender: dto.gender as any, // Cast if enum mismatch
                // Default values for required fields if any (schema check needed usually, but typically nullable)
                phone: '0000000000', // Placeholder
                address: 'HQ',
                jobTitle: 'Super Admin',
            }
        });

        return user;
    }

    async registerAdmin(
        dto: RegisterAdminDto,
        files?: {
            insurance?: Express.Multer.File[],
            pf?: Express.Multer.File[],
            personal?: Express.Multer.File[],
            educational?: Express.Multer.File[],
            profilePicture?: Express.Multer.File[]
        },
        creatorUserId?: string
    ) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) throw new ConflictException('Email already exists');

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        let department = await this.prisma.department.findUnique({ where: { name: dto.departmentName } });
        if (!department) {
            department = await this.prisma.department.create({ data: { name: dto.departmentName } });
        }

        return this.prisma.$transaction(async (prisma) => {
            const profilePicFile = files?.profilePicture?.[0];
            const profileImageUrl = profilePicFile ? `/uploads/${profilePicFile.originalname}` : undefined;

            const user = await prisma.user.create({
                data: {
                    email: dto.email,
                    password: hashedPassword,
                    role: Role.ADMIN,
                    departmentId: department.id,
                    profileImage: profileImageUrl,
                },
            });

            const employee = await prisma.employee.create({
                data: {
                    userId: user.id,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    gender: dto.gender,
                    phone: dto.phone,
                    address: dto.address,
                    jobTitle: dto.jobTitle,
                    salary: dto.salary ? parseFloat(dto.salary) : undefined,
                    joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
                    dob: dto.dob ? new Date(dto.dob) : undefined,
                    bloodGroup: dto.bloodGroup,
                }
            });

            // Handle files
            if (files && creatorUserId) {
                const fileTypes = [
                    { key: 'insurance', type: DocumentType.INSURANCE },
                    { key: 'pf', type: DocumentType.PF },
                    { key: 'personal', type: DocumentType.PERSONAL },
                    { key: 'educational', type: DocumentType.EDUCATIONAL },
                ];

                for (const { key, type } of fileTypes) {
                    if (files[key] && files[key][0]) {
                        const file = files[key][0];
                        await prisma.employeeDocument.create({
                            data: {
                                employeeId: employee.id,
                                type: type,
                                title: `${type} Document`,
                                fileUrl: `/uploads/${file.originalname}`, // Placeholder
                                uploadedByUserId: creatorUserId,
                            }
                        });
                    }
                }
            }

            return { user, employee };
        });
    }

    async registerEmployee(
        dto: RegisterEmployeeDto,
        creatorDepartmentId?: string,
        files?: {
            insurance?: Express.Multer.File[],
            pf?: Express.Multer.File[],
            personal?: Express.Multer.File[],
            educational?: Express.Multer.File[],
            profilePicture?: Express.Multer.File[]
        },
        creatorUserId?: string
    ) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) throw new ConflictException('Email already exists');

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Determine department
        const departmentId = creatorDepartmentId || dto.departmentId;
        if (!departmentId) {
            throw new ConflictException('Department ID is required');
        }

        // Transaction to create User and Employee
        return this.prisma.$transaction(async (prisma) => {
            const profilePicFile = files?.profilePicture?.[0];
            const profileImageUrl = profilePicFile ? `/uploads/${profilePicFile.originalname}` : undefined;

            const user = await prisma.user.create({
                data: {
                    email: dto.email,
                    password: hashedPassword,
                    role: Role.EMPLOYEE,
                    departmentId: departmentId,
                    profileImage: profileImageUrl,
                }
            });

            const employee = await prisma.employee.create({
                data: {
                    userId: user.id,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    gender: dto.gender,
                    phone: dto.phone,
                    address: dto.address,
                    jobTitle: dto.jobTitle,
                    salary: dto.salary ? parseFloat(dto.salary) : undefined,
                    joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
                    dob: dto.dob ? new Date(dto.dob) : undefined,
                    bloodGroup: dto.bloodGroup,
                }
            });

            // Handle files
            if (files && creatorUserId) {
                const fileTypes = [
                    { key: 'insurance', type: DocumentType.INSURANCE },
                    { key: 'pf', type: DocumentType.PF },
                    { key: 'personal', type: DocumentType.PERSONAL },
                    { key: 'educational', type: DocumentType.EDUCATIONAL },
                ];

                for (const { key, type } of fileTypes) {
                    if (files[key] && files[key][0]) {
                        const file = files[key][0];
                        await prisma.employeeDocument.create({
                            data: {
                                employeeId: employee.id,
                                type: type,
                                title: `${type} Document`,
                                fileUrl: `/uploads/${file.originalname}`, // Placeholder
                                uploadedByUserId: creatorUserId,
                            }
                        });
                    }
                }
            }

            return { user, employee };
        });
    }
}
