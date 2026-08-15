import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SosStatus } from '@prisma/client';

export class UpdateSosStatusDto {
    @IsEnum(SosStatus)
    status: SosStatus;

    @IsOptional()
    @IsString()
    resolutionNotes?: string;
}
