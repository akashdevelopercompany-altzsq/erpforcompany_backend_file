import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';

@Module({
    imports: [PrismaModule, FilesModule],
    controllers: [FinanceController],
    providers: [FinanceService],
})
export class FinanceModule { }
