import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, ForbiddenException, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommunicationService } from './communication.service';
import { FilesService } from '../files/files.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateCallDto } from './dto/create-call.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FileCategory } from '@prisma/client';

@Controller('communication')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
    constructor(
        private readonly communicationService: CommunicationService,
        private readonly filesService: FilesService
    ) { }

    @Get('directory')
    async getDirectory(@Request() req, @Query('q') query: string) {
        return this.communicationService.getDirectory(req.user, query);
    }

    @Get('conversations')
    async getConversations(@Request() req) {
        return this.communicationService.getConversations(req.user.id);
    }

    @Post('conversations')
    async startConversation(@Request() req, @Body() dto: CreateConversationDto) {
        return this.communicationService.startConversation(req.user.id, dto.targetUserId);
    }

    @Get('conversations/:id/messages')
    async getMessages(@Request() req, @Param('id') id: string) {
        return this.communicationService.getMessages(id, req.user.id);
    }

    @Post('conversations/:id/messages')
    @UseInterceptors(FileInterceptor('file'))
    async sendMessage(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
        @UploadedFile() file: Express.Multer.File
    ) {
        if (file) {
            const storedFile = await this.filesService.store(file, req.user.id, FileCategory.CHAT_MEDIA);
            dto.fileUrl = storedFile.url || ''; // Use the Storage Path (e.g. "other/xyz.jpg")
            dto.fileType = storedFile.mimeType;
            dto.storedFileId = storedFile.id;
        }
        return this.communicationService.sendMessage(id, req.user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Put('messages/:id')
    async editMessage(@Request() req, @Param('id') id: string, @Body() body: { content: string }) {
        return this.communicationService.updateMessage(id, req.user.id, body.content);
    }

    @Get('calls/history')
    async getCallHistory(@Request() req) {
        return this.communicationService.getCallHistory(req.user.id);
    }

    @Delete('calls/:id')
    @UseGuards(JwtAuthGuard)
    async deleteCallSession(@Request() req, @Param('id') id: string) {
        if (req.user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException('Only Super Admins can delete call records');
        }
        return this.communicationService.deleteCallSession(id);
    }

    @Get('calls/all')
    async getAllCallHistory(@Request() req) {
        console.log('[CommunicationController] getAllCallHistory hit. User:', req.user);
        if (req.user.role !== 'SUPER_ADMIN') {
            console.error('[CommunicationController] Access denied. Role:', req.user.role);
            throw new ForbiddenException('Access denied');
        }
        return this.communicationService.getAllCallHistory();
    }

    @Post('calls')
    async createCallSession(@Request() req, @Body() dto: CreateCallDto) {
        return this.communicationService.createCallSession(req.user.id, dto);
    }
}
