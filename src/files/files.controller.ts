import { Controller, Get, Param, Res, UseGuards, Request, ForbiddenException, NotFoundException, StreamableFile } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import type { Response } from 'express';

@Controller('files')
export class FilesController {
    constructor(private readonly filesService: FilesService) { }

    @Get('public/:id')
    async getPublicFile(@Param('id') id: string, @Res() res: Response) {
        try {
            const file = await this.filesService.findOne(id) as any;
            console.log(`[FilesController] Public Access ID: ${id}, Category: ${file.category}, Type: ${file.data ? 'DB' : 'Supabase'}`);

            if (file.category !== 'ANNOUNCEMENT' && file.category !== 'PROFILE_PICTURE' && file.category !== 'EMPLOYEE_DOCUMENT') {
                throw new ForbiddenException(`Access denied: File category '${file?.category}' is not public`);
            }

            // Handle Supabase Files
            if (file.url) {
                const signedUrl = await this.filesService.getSignedUrl(file.url);
                if (signedUrl) {
                    return res.redirect(signedUrl);
                }
                throw new NotFoundException('File URL generation failed');
            }

            // Handle Legacy DB Files
            if (file.data) {
                res.set({
                    'Content-Type': file.mimeType,
                    'Content-Disposition': `inline; filename="${file.filename}"`,
                    'Content-Length': file.size,
                });
                res.send(file.data);
                return;
            }

            throw new NotFoundException('File data not found');

        } catch (error) {
            console.error('[FilesController] getPublicFile Error:', error);
            if (!res.headersSent) {
                if (error instanceof ForbiddenException) return res.status(403).send(error.message);
                if (error instanceof NotFoundException) return res.status(404).send(error.message);
                return res.status(500).send('Internal Server Error');
            }
        }
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getFile(@Param('id') id: string, @Request() req, @Res() res: Response) {
        try {
            const file = await this.filesService.findOne(id) as any;
            const user = req.user;

            // RBAC Logic
            if (user.role === Role.SUPER_ADMIN) {
                // Allow access
            } else if (user.role === Role.ADMIN) {
                if (!user.departmentId) {
                    if (file.uploadedByUserId !== user.id) {
                        throw new ForbiddenException('Access denied: Admin has no department assigned');
                    }
                } else {
                    const uploaderDepartmentId = file.uploadedBy?.departmentId;
                    if (user.departmentId !== uploaderDepartmentId) {
                        throw new ForbiddenException('Access denied: File belongs to another department');
                    }
                }
            } else {
                // Employee Checks
                if (file.uploadedByUserId === user.id) {
                    // Allow
                }
                else if (file.category === 'TASK_ATTACHMENT') {
                    const isAssignedToTask = (file as any).tasks?.some(t => t.employee?.userId === user.id);
                    if (!isAssignedToTask) {
                        throw new ForbiddenException('Access denied: You are not assigned to the task for this file');
                    }
                }
                else if (file.category === 'ANNOUNCEMENT') {
                    // Allow
                }
                else {
                    throw new ForbiddenException('Access denied: You are not the owner of this file');
                }
            }

            // Handle Supabase Files
            if (file.url) {
                const signedUrl = await this.filesService.getSignedUrl(file.url);
                if (signedUrl) {
                    return res.redirect(signedUrl);
                }
                throw new NotFoundException('File URL generation failed');
            }

            // Handle Legacy DB Files
            if (file.data) {
                res.set({
                    'Content-Type': file.mimeType,
                    'Content-Disposition': `inline; filename="${file.filename}"`,
                    'Content-Length': file.size,
                });
                res.send(file.data);
                return;
            }

            throw new NotFoundException('File data not found');

        } catch (error) {
            console.error('[FilesController] getFile Error:', error);
            if (!res.headersSent) {
                if (error instanceof ForbiddenException) return res.status(403).send(error.message);
                if (error instanceof NotFoundException) return res.status(404).send(error.message);
                return res.status(500).send('Internal Server Error');
            }
        }
    }
}
