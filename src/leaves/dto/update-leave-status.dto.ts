import { IsEnum, IsNotEmpty } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class UpdateLeaveStatusDto {
    @IsEnum(LeaveStatus)
    @IsNotEmpty()
    status: LeaveStatus;
}
