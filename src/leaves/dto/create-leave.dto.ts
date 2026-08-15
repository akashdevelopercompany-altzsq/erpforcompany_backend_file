import { IsDateString, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeaveDto {
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(50, { message: 'Reason must be at least 50 characters long' })
    reason: string;

    @IsDateString()
    @IsNotEmpty()
    startDate: string;

    @IsDateString()
    @IsNotEmpty()
    endDate: string;
}
