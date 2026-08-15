import { IsEnum, IsNotEmpty, IsString, IsUrl, IsUUID } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
    @IsUUID()
    @IsNotEmpty()
    employeeId: string;

    @IsEnum(DocumentType)
    @IsNotEmpty()
    type: DocumentType;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsUrl() // Or IsString if just a path
    @IsNotEmpty()
    fileUrl: string;
}
