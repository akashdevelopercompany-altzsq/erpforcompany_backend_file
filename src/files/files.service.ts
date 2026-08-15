    import { Injectable, NotFoundException } from '@nestjs/common';
    import { PrismaService } from '../prisma.service';
    import { FileCategory } from '@prisma/client';
    import { createClient } from '@supabase/supabase-js';
    import { v4 as uuidv4 } from 'uuid';
    import * as path from 'path';

    @Injectable()
    export class FilesService {
        private supabase = createClient(
            process.env.SUPABASE_URL || 'https://wqqpafsisdnsgpwipyqg.supabase.co',
            process.env.SUPABASE_KEY || process.env.JWT_SECRET || 'placeholder-key'
        );

        private readonly BUCKET_NAME = 'project-files';

        constructor(private prisma: PrismaService) { }

        async store(file: Express.Multer.File, userId: string, category: FileCategory = FileCategory.OTHER) {
            // HEIC Conversion Setup
            let fileBuffer = file.buffer;
            let mimeType = file.mimetype;
            let originalName = file.originalname;
            const ext = path.extname(originalName).toLowerCase();

            console.log(`[FilesService] Processing upload: ${originalName}, Mime: ${mimeType}, Ext: ${ext}`);

            // Check for HEIC/HEIF (MIME or Extension)
            const isHeic =
                mimeType === 'image/heic' ||
                mimeType === 'image/heif' ||
                ext === '.heic' ||
                ext === '.heif';

            if (isHeic) {
                console.log('[FilesService] HEIC/HEIF detected, attempting conversion...');
                try {
                    const heicConvert = require('heic-convert');
                    // Convert to JPEG
                    fileBuffer = await heicConvert({
                        buffer: file.buffer,
                        format: 'JPEG',
                        quality: 0.9 // 0 to 1
                    });

                    mimeType = 'image/jpeg';
                    originalName = originalName.replace(/\.(heic|heif)$/i, '.jpg');
                    console.log(`[FilesService] Converted HEIC/HEIF to JPEG: ${originalName}`);
                } catch (err) {
                    console.error('[FilesService] HEIC conversion failed:', err);
                    throw new Error('Failed to convert HEIC image to JPEG. Please ensure the file is valid.');
                }
            }

            // Generate a unique path: CATEGORY/uuid-filename
            const fileExt = path.extname(originalName);
            const fileName = `${uuidv4()}${fileExt}`;
            const filePath = `${category}/${fileName}`;

            // Upload to Supabase
            const { error } = await this.supabase
                .storage
                .from(this.BUCKET_NAME)
                .upload(filePath, fileBuffer, {
                    contentType: mimeType,
                    upsert: false
                });

            if (error) {
                console.error('[FilesService] Supabase upload error:', error);
                throw new Error('Failed to upload file to storage');
            }

            // Store metadata in DB
            return this.prisma.storedFile.create({
                data: {
                    filename: originalName,
                    mimeType: mimeType,
                    data: null, // No longer storing BLOB
                    url: filePath, // Storing the Supabase Storage Path
                    size: fileBuffer.length,
                    uploadedByUserId: userId,
                    category,
                } as any,
            });
        }

        async findOne(id: string) {
            const file = await this.prisma.storedFile.findUnique({
                where: { id },
                include: {
                    uploadedBy: {
                        include: {
                            department: true,
                            employee: true
                        }
                    },
                    tasks: {
                        include: {
                            employee: true
                        }
                    }
                },
            });

            if (!file) {
                throw new NotFoundException('File not found');
            }
            return file;
        }

        async getSignedUrl(filePath: string): Promise<string | null> {
            const { data, error } = await this.supabase
                .storage
                .from(this.BUCKET_NAME)
                .createSignedUrl(filePath, 3600); // Valid for 1 hour

            if (error) {
                console.error('[FilesService] Signed URL error:', error);
                return null;
            }
            return data.signedUrl;
        }
    }
