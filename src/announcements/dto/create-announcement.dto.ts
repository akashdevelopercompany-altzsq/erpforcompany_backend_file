import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateAnnouncementDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    body: string;

    @IsUUID()
    @IsOptional()
    departmentId?: string;

    @IsOptional()
    @IsString()
    mediaUrl?: string;

    @IsOptional()
    @IsString()
    mediaType?: string;
}
