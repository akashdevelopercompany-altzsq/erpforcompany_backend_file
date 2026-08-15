
import { Controller, Get, Post, Put, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { FoodService } from './food.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';

@Controller('food')
@UseGuards(JwtAuthGuard)
export class FoodController {
    constructor(private readonly foodService: FoodService) { }

    @Get('balance')
    getMyBalance(@Request() req) {
        return this.foodService.getMyBalance(req.user.id);
    }

    @Get('transactions')
    getMyTransactions(@Request() req) {
        return this.foodService.getMyTransactions(req.user.id);
    }

    @Post('consume')
    consume(@Request() req, @Body() body: { tokens: number }) {
        return this.foodService.consumeTokens(req.user.id, body.tokens || 1);
    }

    // ================= SUPER ADMIN ENDPOINTS =================
    
    @Get('admin/stats')
    getAdminStats(@Request() req) {
        // Only allow SUPER_ADMIN
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.getAdminStats();
    }

    @Get('admin/orders/today')
    getTodayOrders(@Request() req) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.getTodayOrders();
    }

    @Put('admin/orders/:id/status')
    updateOrderStatus(
        @Request() req,
        @Param('id') orderId: string,
        @Body() body: { status: string }
    ) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.updateOrderStatus(orderId, body.status);
    }

    @Get('admin/menu')
    getMenuItems(@Request() req) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.getAllMenuItems();
    }

    @Post('admin/menu')
    createMenuItem(
        @Request() req,
        @Body() body: { name: string; description?: string; price: number; category?: string; isAvailable?: boolean }
    ) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.createMenuItem(body);
    }

    @Put('admin/menu/:id')
    updateMenuItem(
        @Request() req,
        @Param('id') itemId: string,
        @Body() body: { name?: string; description?: string; price?: number; category?: string; isAvailable?: boolean }
    ) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.updateMenuItem(itemId, body);
    }

    @Delete('admin/menu/:id')
    deleteMenuItem(
        @Request() req,
        @Param('id') itemId: string
    ) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.deleteMenuItem(itemId);
    }

    @Get('admin/reports')
    getFoodReports(@Request() req) {
        if (req.user.role !== Role.SUPER_ADMIN) {
            throw new Error('Unauthorized');
        }
        return this.foodService.getFoodReports();
    }
}
