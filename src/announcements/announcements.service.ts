import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AnnouncementsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateAnnouncementDto, creator: any) {
        if (creator.role === Role.ADMIN) {
            // Force departmentId to be creator's department
            if (dto.departmentId && dto.departmentId !== creator.departmentId) {
                throw new ForbiddenException('Cannot create announcement for another department');
            }
            // If not provided, default to creator's department
            if (!dto.departmentId) {
                dto.departmentId = creator.departmentId;
            }
        }

        return this.prisma.announcement.create({
            data: {
                title: dto.title,
                body: dto.body,
                departmentId: dto.departmentId, // Can be null for global (SuperAdmin only)
                createdByUserId: creator.id,
                mediaUrl: dto.mediaUrl,
                mediaType: dto.mediaType,
            }
        });
    }

    async findAll(user: any) {
        // Everyone sees Global announcements (departmentId: null)
        // AND announcements for their department

        const whereClause: any = {
            OR: [
                { departmentId: null }, // Global
            ]
        };

        if (user.departmentId) {
            whereClause.OR.push({ departmentId: user.departmentId });
        }

        return this.prisma.announcement.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: { createdBy: { select: { email: true, role: true, employee: { select: { firstName: true, lastName: true } } } } }
        });
    }

    async update(id: string, data: any) {
        return this.prisma.announcement.update({
            where: { id },
            data: {
                title: data.title,
                body: data.body,
                mediaUrl: data.mediaUrl,
                mediaType: data.mediaType
            }
        });
    }

    async remove(id: string) {
        return this.prisma.announcement.delete({
            where: { id }
        });
    }
}
