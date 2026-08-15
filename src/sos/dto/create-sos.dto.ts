import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';
import { SosSource } from '@prisma/client';

export class CreateSosDto {
    @IsEnum(SosSource)
    source: SosSource;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsLatitude()
    latitude?: number;

    @IsOptional()
    @IsLongitude()
    longitude?: number;
}
