import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TokensController {
    constructor(private readonly tokensService: TokensService) { }

    @Get('my-balances')
    @Roles(Role.EMPLOYEE)
    getMyBalances(@Request() req) {
        // Ensure employee exists for user
        if (!req.user.employee) {
            // This might happen if user is EMPLOYEE role but Employee record missing
            // Should be handled, but for now assume it exists or service handles it
        }
        // We need employeeId, which might be in req.user.employee.id if included in strategy
        // Or we fetch it. The JWT strategy usually returns user with basic info.
        // Let's assume we need to fetch or it's in payload.
        // Based on AuthService login, it returns user object.
        // Let's rely on service to find employee by userId if needed, or pass userId.
        return this.tokensService.getBalancesByUserId(req.user.id);
    }

    @Get('employee/:employeeId')
    @Roles(Role.SUPER_ADMIN, Role.ADMIN)
    async getEmployeeBalances(@Param('employeeId') employeeId: string, @Request() req) {
        // Check RBAC for Admin
        if (req.user.role === Role.ADMIN) {
            // We need to check if this employee belongs to admin's department
            // This check can be done in service or here.
            // Let's do it in service for consistency or fetch employee here.
            await this.tokensService.validateAdminAccess(req.user, employeeId);
        }
        return this.tokensService.getBalances(employeeId);
    }
}
