import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [PrismaModule, FilesModule],
    controllers: [DocumentsController],
    providers: [DocumentsService],
})
export class DocumentsModule { }
