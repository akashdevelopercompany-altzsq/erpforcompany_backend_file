import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
    @IsEnum(TicketStatus)
    @IsNotEmpty()
    status: TicketStatus;

    @IsString()
    @IsOptional()
    resolution?: string;
}
