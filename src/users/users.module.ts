import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { ProfileController } from './profile.controller';

@Module({
    imports: [PrismaModule, FilesModule],
    controllers: [UsersController, ProfileController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
