import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateFinanceReportDto } from './dto/create-finance-report.dto';

@Injectable()
export class FinanceService {
    constructor(private prisma: PrismaService) { }

    async createReport(userId: string, createFinanceReportDto: CreateFinanceReportDto, storedFileId?: string) {
        // Enforce strict check: User must be ADMIN and in Finance Department
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { department: true }
        });

        if (!user || user.role !== 'ADMIN') {
            throw new Error('Unauthorized');
        }

        if (!user.department || !user.department.name.toLowerCase().includes('finance')) {
            throw new Error('Only Finance Department Admins can upload reports');
        }

        return this.prisma.financeReport.create({
            data: {
                title: createFinanceReportDto.title,
                type: createFinanceReportDto.type,
                fileUrl: createFinanceReportDto.fileUrl,
                storedFileId: storedFileId,
                periodStart: new Date(createFinanceReportDto.periodStart),
                periodEnd: new Date(createFinanceReportDto.periodEnd),
                createdByUserId: userId
            }
        });
    }

    async findAllReports() {
        return this.prisma.financeReport.findMany({
            orderBy: { createdAt: 'desc' },
            include: { createdBy: { select: { email: true, role: true } } }
        });
    }
}
