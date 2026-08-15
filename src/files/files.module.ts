import { Module, forwardRef } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeesModule } from '../employees/employees.module'; // Needed for Department check if finding employee by user id

@Module({
    imports: [PrismaModule, forwardRef(() => EmployeesModule)],
    controllers: [FilesController],
    providers: [FilesService],
    exports: [FilesService],
})
export class FilesModule { }
