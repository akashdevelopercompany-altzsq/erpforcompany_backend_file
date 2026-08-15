
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FoodOrderStatus } from '@prisma/client';

@Injectable()
export class FoodService {
    constructor(private prisma: PrismaService) { }

    async getMyBalance(userId: string) {
        // 1. Get Employee
        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new NotFoundException('Employee profile not found');

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // 2. Find Balance
        let balance = await this.prisma.foodTokenBalance.findUnique({
            where: {
                employeeId_year_month: {
                    employeeId: employee.id,
                    year,
                    month
                }
            }
        });

        // 3. Create if missing (Auto-allocate 20 tokens for now - configurable later)
        if (!balance) {
            balance = await this.prisma.foodTokenBalance.create({
                data: {
                    employeeId: employee.id,
                    year,
                    month,
                    totalTokens: 20, // Default allocation
                    usedTokens: 0
                }
            });
        }

        return balance;
    }

    async getMyTransactions(userId: string) {
        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new NotFoundException('Employee profile not found');

        return this.prisma.foodTransaction.findMany({
            where: { employeeId: employee.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
    }

    async consumeTokens(userId: string, tokensRequested: number) {
        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new NotFoundException('Employee profile not found');

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Ensure balance exists
        let balance = await this.prisma.foodTokenBalance.findUnique({
            where: { employeeId_year_month: { employeeId: employee.id, year, month } }
        });

        if (!balance) {
            balance = await this.prisma.foodTokenBalance.create({
                data: { employeeId: employee.id, year, month, totalTokens: 20, usedTokens: 0 }
            });
        }

        const remaining = balance.totalTokens - balance.usedTokens;

        // Transaction Logic
        let transactionType: 'TOKEN' | 'USE_EXTRA' = 'TOKEN';
        let amountCharged = 0;

        if (remaining >= tokensRequested) {
            // Can pay fully with tokens
            await this.prisma.foodTokenBalance.update({
                where: { id: balance.id },
                data: { usedTokens: { increment: tokensRequested } }
            });
        } else {
            // Not enough tokens
            transactionType = 'USE_EXTRA';
            amountCharged = 50 * tokensRequested; // e.g. 50 currency per meal if extra
            // Should we consume remaining tokens? For simplicity, if we go extra, we just charge extra for the whole batch or partial?
            // Let's assume strict: if you have 0 tokens, you pay. If you have 1 but need 2, you use 1 token + pay for 1?
            // Simplified: If you have enough, use tokens. If NOT, pay for ALL (or simple overdraft logic).
            // Let's go with: Use tokens if available, else CHARGE.

            if (remaining > 0) {
                // Use partial
                const tokensToDeduct = remaining;
                const extra = tokensRequested - remaining;
                amountCharged = extra * 50;

                await this.prisma.foodTokenBalance.update({
                    where: { id: balance.id },
                    data: { usedTokens: { increment: tokensToDeduct } }
                });

                // Create 2 transactions? Or one mixed?
                // For simplicity, just mark this as USE_EXTRA with mixed description
            } else {
                amountCharged = tokensRequested * 50;
            }
        }

        return this.prisma.foodTransaction.create({
            data: {
                employeeId: employee.id,
                tokensUsed: transactionType === 'TOKEN' ? tokensRequested : (remaining > 0 ? remaining : 0),
                type: transactionType,
                amountCharged: amountCharged,
                description: `Consumed ${tokensRequested} meal(s)`
            }
        });
    }

    // ================= SUPER ADMIN METHODS =================
    
    async getAdminStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Total meals booked today
        const totalMealsToday = await this.prisma.foodOrder.count({
            where: {
                createdAt: {
                    gte: today,
                    lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });
        
        // Total menu items
        const totalMenuItems = await this.prisma.foodItem.count();
        
        // Orders by status
        const pendingOrders = await this.prisma.foodOrder.count({
            where: { status: 'PENDING' }
        });
        
        const deliveredOrders = await this.prisma.foodOrder.count({
            where: { status: 'DELIVERED' }
        });
        
        return {
            totalMealsToday,
            totalMenuItems,
            pendingOrders,
            deliveredOrders
        };
    }

    async getTodayOrders() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const orders = await this.prisma.foodOrder.findMany({
            where: {
                createdAt: {
                    gte: today,
                    lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            include: {
                employee: {
                    include: {
                        user: true
                    }
                },
                items: {
                    include: {
                        foodItem: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return orders;
    }

    async updateOrderStatus(orderId: string, status: string) {
        const validStatuses = Object.values(FoodOrderStatus);
        if (!validStatuses.includes(status as FoodOrderStatus)) {
            throw new BadRequestException('Invalid order status');
        }
        
        return this.prisma.foodOrder.update({
            where: { id: orderId },
            data: { status: status as FoodOrderStatus }
        });
    }

    async getAllMenuItems() {
        return this.prisma.foodItem.findMany({
            orderBy: {
                name: 'asc'
            }
        });
    }

    async createMenuItem(data: {
        name: string;
        description?: string;
        price: number;
        category?: string;
        isAvailable?: boolean;
    }) {
        return this.prisma.foodItem.create({
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                category: data.category || 'MEAL',
                isAvailable: data.isAvailable ?? true
            }
        });
    }

    async updateMenuItem(itemId: string, data: {
        name?: string;
        description?: string;
        price?: number;
        category?: string;
        isAvailable?: boolean;
    }) {
        return this.prisma.foodItem.update({
            where: { id: itemId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.price && { price: data.price }),
                ...(data.category && { category: data.category }),
                ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable })
            }
        });
    }

    async deleteMenuItem(itemId: string) {
        return this.prisma.foodItem.delete({
            where: { id: itemId }
        });
    }

    async getFoodReports() {
        const totalOrders = await this.prisma.foodOrder.count();
        const totalRevenue = await this.prisma.foodOrder.aggregate({
            _sum: {
                totalAmount: true
            }
        });
        
        const ordersByStatus = await this.prisma.foodOrder.groupBy({
            by: ['status'],
            _count: true
        });
        
        // Get popular items
        const allOrderItems = await this.prisma.foodOrderItem.findMany({
            include: {
                foodItem: true
            }
        });
        
        const itemQuantities = allOrderItems.reduce((acc: any, item) => {
            const key = item.foodItemId;
            if (!acc[key]) {
                acc[key] = {
                    foodItem: item.foodItem,
                    totalQuantity: 0
                };
            }
            acc[key].totalQuantity += item.quantity;
            return acc;
        }, {});
        
        const popularItems = Object.values(itemQuantities)
            .sort((a: any, b: any) => b.totalQuantity - a.totalQuantity)
            .slice(0, 5);
        
        return {
            totalOrders,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
            ordersByStatus,
            popularItems
        };
    }
}
