
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { LeavesModule } from './leaves/leaves.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SosModule } from './sos/sos.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PrismaModule } from './prisma/prisma.module';
import { TokensModule } from './tokens/tokens.module';
import { DocumentsModule } from './documents/documents.module';
import { DepartmentsModule } from './departments/departments.module';
import { PerformanceModule } from './performance/performance.module';
import { TasksModule } from './tasks/tasks.module';
import { TicketsModule } from './tickets/tickets.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ProfileModule } from './profile/profile.module';
import { CommunicationModule } from './communication/communication.module';
import { TeamsModule } from './teams/teams.module';
import { ProjectsModule } from './projects/projects.module';
import { TransportModule } from './transport/transport.module';
import { FoodModule } from './food/food.module';
import { DevelopmentModule } from './development/development.module';
import { FilesModule } from './files/files.module';

import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './scheduler/scheduler.module';
import { CalendarModule } from './calendar/calendar.module';
import { FinanceModule } from './finance/finance.module';
import { MeetingsModule } from './meetings/meetings.module';


@Module({
    imports: [
        ScheduleModule.forRoot(),
        EventEmitterModule.forRoot(),
        ConfigModule.forRoot({ isGlobal: true }),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads',
        }),
        PrismaModule,
        AuthModule,
        UsersModule,
        EmployeesModule,
        LeavesModule,
        NotificationsModule,
        SosModule,
        AttendanceModule,
        LeaveModule,
        TokensModule,
        DocumentsModule,
        DepartmentsModule,
        PerformanceModule,
        TasksModule,
        TicketsModule,
        AnnouncementsModule,
        ProfileModule,
        CommunicationModule,
        TeamsModule,
        ProjectsModule,
        TransportModule,
        FoodModule,
        DevelopmentModule,
        FilesModule,
        SchedulerModule,
        CalendarModule,
        FinanceModule,
        MeetingsModule

    ],
})
export class AppModule { }
