import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCallDto {
    @IsString()
    @IsNotEmpty()
    calleeId: string;

    @IsString()
    @IsOptional()
    reason?: string;
}
