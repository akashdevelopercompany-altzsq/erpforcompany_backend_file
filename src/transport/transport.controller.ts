import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { TransportService } from './transport.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransportController {
    constructor(private readonly transportService: TransportService) { }

    @Post('generate-assignments')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    generateAssignments(@Body() body: { date: string }) {
        return this.transportService.generateDailyAssignments(new Date(body.date));
    }

    @Get('all-trips')
    @Roles('ADMIN', 'SUPER_ADMIN')
    getAllTrips(@Query('date') date: string) {
        return this.transportService.getAllTrips(date);
    }

    @Get('my-ride')
    getMyRide(@Request() req, @Query('date') date: string) {
        return this.transportService.getEmployeeRide(req.user.id, date);
    }

    @Get('routes/:id/alternatives')
    getAlternatives(@Param('id') routeId: string, @Query('date') date: string) {
        return this.transportService.getAlternativeRides(routeId, date);
    }

    @Post('missed-cab')
    reportMissedCab(@Request() req, @Body() body: { date: string, reason: string }) {
        return this.transportService.reportMissedCab(req.user.id, body);
    }

    // Admin Resources
    @Post('vehicles')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    createVehicle(@Body() data: any) {
        return this.transportService.createVehicle(data);
    }

    @Get('vehicles')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    getVehicles() {
        return this.transportService.getVehicles();
    }

    @Post('drivers')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    createDriver(@Body() data: any) {
        return this.transportService.createDriver(data);
    }

    @Get('drivers')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    getDrivers() {
        return this.transportService.getDrivers();
    }

    @Post('routes')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    createRoute(@Body() data: any) {
        return this.transportService.createRoute(data);
    }

    @Get('routes')
    @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    getRoutes() {
        return this.transportService.getRoutes();
    }
}
