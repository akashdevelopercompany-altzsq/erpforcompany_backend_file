import { IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';

export class CreateTaskDto {
    @IsUUID()
    @IsNotEmpty()
    employeeId: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    dueDate?: string;

    @IsString()
    @IsOptional()
    fileUrl?: string;

    @IsString()
    @IsOptional()
    storedFileId?: string;

    @IsString()
    @IsOptional()
    priority?: string;
}
