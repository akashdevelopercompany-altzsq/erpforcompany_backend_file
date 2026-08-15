import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [TokensController],
    providers: [TokensService, PrismaService],
    exports: [TokensService],
})
export class TokensModule { }
