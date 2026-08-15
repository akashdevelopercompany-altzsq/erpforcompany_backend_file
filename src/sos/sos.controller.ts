import { Controller, Post, Body, Param, Patch, Get, UseGuards, Request } from '@nestjs/common';
import { SosService } from './sos.service';
import { CreateSosDto } from './dto/create-sos.dto';
import { UpdateSosLocationDto } from './dto/update-location.dto';
import { UpdateSosStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sos')
@UseGuards(JwtAuthGuard)
export class SosController {
    constructor(private readonly sosService: SosService) { }

    @Post()
    create(@Request() req, @Body() createSosDto: CreateSosDto) {
        console.log('SOS Controller Request User:', req.user);
        return this.sosService.create(req.user.id, createSosDto);
    }

    @Post(':id/location')
    updateLocation(@Param('id') id: string, @Body() updateLocationDto: UpdateSosLocationDto) {
        return this.sosService.updateLocation(id, updateLocationDto);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateSosStatusDto) {
        return this.sosService.updateStatus(id, updateStatusDto.status, updateStatusDto.resolutionNotes);
    }

    @Get('incidents')
    findAll() {
        return this.sosService.findAll();
    }
}
