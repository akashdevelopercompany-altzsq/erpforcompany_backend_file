import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { PrismaModule } from '../prisma/prisma.module';

import { TokensModule } from '../tokens/tokens.module';

@Module({
    imports: [PrismaModule, TokensModule],
    controllers: [LeavesController],
    providers: [LeavesService],
})
export class LeavesModule { }
