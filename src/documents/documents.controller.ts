import { Controller, Get, Post, Body, Param, UseGuards, Request, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { FilesService } from '../files/files.service';
import type { Express } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, DocumentType } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
    constructor(
        private readonly documentsService: DocumentsService,
        private readonly filesService: FilesService
    ) { }

    @Post()
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async create(
        @Body() createDocumentDto: CreateDocumentDto,
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl: string | undefined = createDocumentDto.fileUrl;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
        }

        return this.documentsService.create(createDocumentDto, req.user, fileUrl, storedFileId);
    }

    @Get('employee/:employeeId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE)
    findAllByEmployee(@Param('employeeId') employeeId: string, @Request() req) {
        return this.documentsService.findAllByEmployee(employeeId, req.user);
    }

    @Get('company/legal')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE)
    findCompanyLegalDocuments() {
        return this.documentsService.findCompanyLegalDocuments();
    }

    @Get('government')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.EMPLOYEE)
    findGovernmentDocuments() {
        return this.documentsService.findGovernmentDocuments();
    }

    @Post('company/legal')
    @Roles(Role.SUPER_ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async uploadCompanyLegalDocument(
        @Body() body: { title: string; category: string },
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl: string | undefined;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
        }

        return this.documentsService.createCompanyLegalDocument(body.title, body.category, fileUrl, storedFileId, req.user.id);
    }

    @Post('government')
    @Roles(Role.SUPER_ADMIN)
    @UseInterceptors(FileInterceptor('file'))
    async uploadGovernmentDocument(
        @Body() body: { title: string; category: string },
        @Request() req,
        @UploadedFile() file: Express.Multer.File
    ) {
        let fileUrl: string | undefined;
        let storedFileId: string | undefined;

        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id);
            storedFileId = storedFile.id;
            fileUrl = `/files/${storedFile.id}`;
        }

        return this.documentsService.createGovernmentDocument(body.title, body.category, fileUrl, storedFileId, req.user.id);
    }
}
