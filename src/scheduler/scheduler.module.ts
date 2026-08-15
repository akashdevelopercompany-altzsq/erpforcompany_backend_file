import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

import { PerformanceModule } from '../performance/performance.module';

@Module({
    imports: [PrismaModule, PerformanceModule],
    providers: [SchedulerService],
    exports: [SchedulerService],
})
export class SchedulerModule { }
