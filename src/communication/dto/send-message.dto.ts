
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class SendMessageDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsString()
    fileType?: string;

    @IsOptional()
    @IsString()
    storedFileId?: string;

    @IsOptional()
    @IsString()
    localId?: string;
}
