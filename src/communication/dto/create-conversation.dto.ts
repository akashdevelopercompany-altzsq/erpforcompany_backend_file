
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConversationDto {
    @IsNotEmpty()
    @IsString()
    targetUserId: string;
}
