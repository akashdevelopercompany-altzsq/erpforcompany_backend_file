
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { UsersModule } from '../users/users.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
    imports: [UsersModule, EmployeesModule],
    controllers: [ProfileController],
    providers: [],
})
export class ProfileModule { }
