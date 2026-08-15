import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { EfficiencyService } from './efficiency.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [FilesModule, PrismaModule, AuthModule, NotificationsModule],
    controllers: [PerformanceController],
    providers: [PerformanceService, EfficiencyService],
    exports: [PerformanceService, EfficiencyService]
})
export class PerformanceModule { }
