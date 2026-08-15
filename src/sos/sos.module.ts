import { Module } from '@nestjs/common';
import { SosService } from './sos.service';
import { SosController } from './sos.controller';
import { SosGateway } from './sos.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SosController],
    providers: [SosService, SosGateway],
    exports: [SosService],
})
export class SosModule { }
