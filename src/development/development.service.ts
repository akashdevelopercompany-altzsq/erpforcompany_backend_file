import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceRequestDto } from './dto/create-resource.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DevelopmentService {
    constructor(
        private prisma: PrismaService,
        private notificationsService: NotificationsService
    ) { }

    async findAll(user: any, status?: string) {
        if (user.role === 'EMPLOYEE') {
            const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!employee) return [];
            return this.prisma.learningResource.findMany({
                where: { employeeId: employee.id },
                orderBy: { createdAt: 'desc' },
            });
        } else {
            // Admin sees requests based on status filter
            const whereClause: any = {};

            if (status === 'PURCHASED') {
                whereClause.status = { in: ['ASSIGNED', 'APPROVED', 'IN_PROGRESS'] };
            } else if (status === 'REQUESTED') {
                whereClause.status = 'REQUESTED';
            } else if (status === 'COMPLETED') {
                whereClause.status = 'COMPLETED';
            } else if (status === 'PROOF') {
                whereClause.status = 'COMPLETED';
                whereClause.certificateUrl = { not: null };
            } else {
                // Default fallback if no status provided
                whereClause.status = 'REQUESTED';
            }

            return this.prisma.learningResource.findMany({
                where: whereClause,
                include: { employee: { include: { user: { include: { department: true } } } } },
                orderBy: { createdAt: 'desc' },
            });
        }
    }

    private generateTokenId(): string {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `REQ-${date}-${random}`;
    }

    async create(user: any, dto: CreateResourceRequestDto) {
        const employee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
        if (!employee) throw new Error('Employee not found');

        return this.prisma.learningResource.create({
            data: {
                employeeId: employee.id,
                title: dto.title,
                description: dto.description || '',
                type: dto.type,
                url: dto.url,
                cost: dto.cost,
                justification: dto.justification,
                status: 'REQUESTED',
                tokenId: this.generateTokenId(),
                paymentStatus: 'PENDING'
            }
        });
    }

    async assign(adminUser: any, dto: { employeeId: string; title: string; type: string; cost: number; url?: string; description?: string }) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: dto.employeeId },
            include: { user: true }
        });
        if (!employee) throw new Error('Employee not found');

        const resource = await this.prisma.learningResource.create({
            data: {
                employeeId: dto.employeeId,
                title: dto.title,
                description: dto.description || 'Assigned by Admin',
                type: dto.type,
                url: dto.url,
                cost: dto.cost,
                status: 'ASSIGNED',
                tokenId: this.generateTokenId(),
                paymentStatus: 'PENDING',
                adminComment: `Assigned by ${adminUser.firstName} ${adminUser.lastName}`
            }
        });

        // Notify Employee
        await this.notificationsService.createAndBroadcast(
            [employee.userId],
            'COURSE_ASSIGNED',
            resource.id,
            {
                title: 'New Course Assigned',
                message: `You have been assigned a new course: ${dto.title}`,
                courseTitle: dto.title
            }
        );

        // Notify Admins/Finance (Simulated via Super Admin notification)
        // In a real app, this would target a FINANCE role. Here we notify other Admins to approve payment.
        const admins = await this.prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
            select: { id: true }
        });

        if (admins.length > 0) {
            await this.notificationsService.createAndBroadcast(
                admins.map(a => a.id),
                'FINANCE_PAYMENT_REQUEST',
                resource.id,
                {
                    title: 'Course Cost Approval Needed',
                    message: `Course "${dto.title}" assigned to ${employee.firstName}. Cost: ₹${dto.cost}. Please process payment.`,
                    cost: dto.cost
                }
            );
        }

        return resource;
    }

    async updateStatus(id: string, status: any, adminComment?: string) {
        return this.prisma.learningResource.update({
            where: { id },
            data: { status, adminComment }
        });
    }

    async submitPaymentUrl(id: string, paymentUrl: string) {
        return this.prisma.learningResource.update({
            where: { id },
            data: { paymentUrl }
        });
    }

    async markAsPaid(id: string) {
        const resource = await this.prisma.learningResource.update({
            where: { id },
            data: { paymentStatus: 'PAID' },
            include: { employee: true }
        });

        // Notify Employee
        if (resource.employee?.userId) {
            await this.notificationsService.createAndBroadcast(
                [resource.employee.userId],
                'COURSE_PURCHASED',
                resource.id,
                {
                    title: 'Course Purchase Confirmed',
                    message: `Your course "${resource.title}" has been purchased by Finance. You can now access it.`
                }
            );
        }

        // Notify Admins
        const admins = await this.prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
            select: { id: true }
        });
        const adminIds = admins.map(a => a.id);

        if (adminIds.length > 0) {
            await this.notificationsService.createAndBroadcast(
                adminIds,
                'COURSE_PURCHASED_ADMIN',
                resource.id,
                {
                    title: 'Course Payment Completed',
                    message: `Payment for "${resource.title}" (Employee: ${resource.employee?.firstName} ${resource.employee?.lastName}) has been processed.`
                }
            );
        }

        return resource;
    }

    async uploadCertificate(id: string, fileUrl: string, storedFileId?: string) {
        return this.prisma.learningResource.update({
            where: { id },
            data: {
                certificateUrl: fileUrl,
                storedFileId,
                status: 'COMPLETED' // Auto-mark as completed on upload
            }
        });
    }
}
