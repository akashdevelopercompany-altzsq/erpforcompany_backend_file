import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSubmissionDto {
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsOptional()
    fileUrl?: string;
}
