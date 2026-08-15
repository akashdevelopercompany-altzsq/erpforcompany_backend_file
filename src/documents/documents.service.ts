import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, DocumentType } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateDocumentDto, uploader: any, fileUrl?: string, storedFileId?: string) {
        // Check RBAC
        if (uploader.role === Role.ADMIN) {
            const employee = await this.prisma.employee.findUnique({
                where: { id: dto.employeeId },
                include: { user: true }
            });
            if (!employee) throw new NotFoundException('Employee not found');
            if (employee.user.departmentId !== uploader.departmentId) {
                throw new ForbiddenException('Cannot upload documents for employee in another department');
            }
        }

        return this.prisma.employeeDocument.create({
            data: {
                employeeId: dto.employeeId,
                type: dto.type,
                title: dto.title,
                fileUrl: fileUrl || dto.fileUrl, // Use uploaded file URL or DTO provided
                storedFileId,
                uploadedByUserId: uploader.id,
            }
        });
    }

    async findAllByEmployee(employeeId: string, user: any) {
        // Check RBAC
        if (user.role === Role.EMPLOYEE) {
            // Can only view own documents
            // We need to check if employeeId matches user's employeeId
            const myEmployee = await this.prisma.employee.findUnique({ where: { userId: user.id } });
            if (!myEmployee || myEmployee.id !== employeeId) {
                throw new ForbiddenException('Access denied');
            }
        } else if (user.role === Role.ADMIN) {
            const employee = await this.prisma.employee.findUnique({
                where: { id: employeeId },
                include: { user: true }
            });
            if (!employee) throw new NotFoundException('Employee not found');
            if (employee.user.departmentId !== user.departmentId) {
                throw new ForbiddenException('Access denied');
            }
        }

        return this.prisma.employeeDocument.findMany({
            where: { employeeId },
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { email: true, role: true } } }
        });
    }

    // Company Legal Documents (mock implementation - can be replaced with actual DB model)
    async findCompanyLegalDocuments() {
        // For now, return mock data or implement with a CompanyDocument model
        return [
            { id: '1', title: 'Company Bylaws 2024', category: 'Governance', fileUrl: '/docs/bylaws.pdf', uploadedAt: new Date('2024-01-15') },
            { id: '2', title: 'Shareholder Agreement', category: 'Corporate', fileUrl: '/docs/shareholder.pdf', uploadedAt: new Date('2024-01-10') },
            { id: '3', title: 'Non-Disclosure Agreement Template', category: 'Legal', fileUrl: '/docs/nda-template.pdf', uploadedAt: new Date('2024-02-01') },
            { id: '4', title: 'Employment Contract Template', category: 'HR', fileUrl: '/docs/employment-contract.pdf', uploadedAt: new Date('2024-01-20') },
        ];
    }

    async findGovernmentDocuments() {
        // Mock implementation for government compliance documents
        return [
            { id: '1', title: 'GST Registration Certificate', category: 'Tax', fileUrl: '/docs/gst-cert.pdf', uploadedAt: new Date('2023-12-01'), expiryDate: new Date('2025-12-01') },
            { id: '2', title: 'Trade License', category: 'Business', fileUrl: '/docs/trade-license.pdf', uploadedAt: new Date('2023-11-15'), expiryDate: new Date('2024-11-15') },
            { id: '3', title: 'PF Registration', category: 'Labor', fileUrl: '/docs/pf-reg.pdf', uploadedAt: new Date('2023-10-10'), expiryDate: null },
            { id: '4', title: 'ESIC Registration', category: 'Labor', fileUrl: '/docs/esic-reg.pdf', uploadedAt: new Date('2023-10-10'), expiryDate: null },
            { id: '5', title: 'Professional Tax Registration', category: 'Tax', fileUrl: '/docs/pt-reg.pdf', uploadedAt: new Date('2023-09-01'), expiryDate: new Date('2024-09-01') },
        ];
    }

    async createCompanyLegalDocument(title: string, category: string, fileUrl: string | undefined, storedFileId: string | undefined, uploaderId: string) {
        // Mock implementation - in production, save to CompanyDocument model
        return {
            id: Date.now().toString(),
            title,
            category,
            fileUrl,
            storedFileId,
            uploadedBy: uploaderId,
            uploadedAt: new Date()
        };
    }

    async createGovernmentDocument(title: string, category: string, fileUrl: string | undefined, storedFileId: string | undefined, uploaderId: string) {
        // Mock implementation - in production, save to GovernmentDocument model
        return {
            id: Date.now().toString(),
            title,
            category,
            fileUrl,
            storedFileId,
            uploadedBy: uploaderId,
            uploadedAt: new Date(),
            expiryDate: null
        };
    }
}
