import { IsString, IsNotEmpty, IsDateString, IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator';

export class CreateMeetingDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsNotEmpty()
    scheduledAt: string;

    @IsNumber()
    @IsNotEmpty()
    duration: number; // in minutes

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsArray()
    @IsString({ each: true })
    participantIds: string[]; // List of Employee IDs (or User IDs? Let's assume Employee IDs to map to MeetingAttendance)
}
