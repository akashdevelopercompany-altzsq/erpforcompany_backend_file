import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleStatus, ShiftType, TicketStatus } from '@prisma/client';

@Injectable()
export class TransportService {
    constructor(private prisma: PrismaService) { }

    // --- Admin: Manage Resources ---

    async createVehicle(data: any) {
        return this.prisma.vehicle.create({ data });
    }

    async getVehicles() {
        return this.prisma.vehicle.findMany({ orderBy: { createdAt: 'desc' } });
    }

    async createDriver(data: any) {
        return this.prisma.driver.create({ data });
    }

    async getDrivers() {
        return this.prisma.driver.findMany({ orderBy: { createdAt: 'desc' } });
    }

    async createRoute(data: any) {
        return this.prisma.route.create({ data });
    }

    async getRoutes() {
        return this.prisma.route.findMany({
            include: { trips: true },
            orderBy: { name: 'asc' }
        });
    }

    // --- Core: Daily Assignment Generation ---

    async generateDailyAssignments(date: Date) {
        // 1. Get all active drivers and vehicles
        const drivers = await this.prisma.driver.findMany({ where: { isActive: true } });
        const vehicles = await this.prisma.vehicle.findMany({ where: { status: VehicleStatus.ACTIVE } });
        const routes = await this.prisma.route.findMany();

        // 2. Clear existing trips for the day to allow regeneration
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        // Note: In production, handle with care. For now, we assume regeneration clears old drafts.
        // await this.prisma.cabTrip.deleteMany({ where: { date: { gte: startOfDay, lte: endOfDay } } }); 

        // 3. Shuffle Algorithms
        const shuffledDrivers = [...drivers].sort(() => 0.5 - Math.random());
        const shuffledVehicles = [...vehicles].sort(() => 0.5 - Math.random());

        const assignments: any[] = [];
        const assignedEmployeeIds = new Set<string>();
        let vehicleIndex = 0;
        let driverIndex = 0;

        for (const route of routes) {
            // Assign vehicles to routes based on demand (mock: 1 vehicle per route for now)
            if (vehicleIndex >= shuffledVehicles.length || driverIndex >= shuffledDrivers.length) break;

            const vehicle = shuffledVehicles[vehicleIndex++];
            const driver = shuffledDrivers[driverIndex++];

            const trip = await this.prisma.cabTrip.create({
                data: {
                    date: date,
                    shift: ShiftType.MORNING,
                    vehicleId: vehicle.id,
                    driverId: driver.id,
                    routeId: route.id,
                }
            });

            // Assign Employees (Mock: all employees in the system, randomized)
            // In reality, you'd filter by 'Transport Opt-In' and 'Route'
            const allEmployees = await this.prisma.employee.findMany();
            const employeesForRoute = allEmployees.filter(e => Math.random() > 0.5 && !assignedEmployeeIds.has(e.id));

            // Limit to capacity
            const selectedEmployees = employeesForRoute.slice(0, vehicle.capacity);

            for (const emp of selectedEmployees) {
                await this.prisma.cabPassengerAssignment.create({
                    data: {
                        cabTripId: trip.id,
                        employeeId: emp.id,
                        pickupPoint: (route as any).pickupPoints?.[0] || 'Office',
                        dropPoint: 'Office',
                        pickupTime: new Date(date.setHours(8, 0, 0, 0)),
                        dropTime: new Date(date.setHours(9, 0, 0, 0))
                    }
                });
                assignedEmployeeIds.add(emp.id);
            }
            assignments.push(trip);
        }

        return { message: 'Daily assignments generated', count: assignments.length };
    }

    async getAllTrips(dateStr: string) {
        const date = new Date(dateStr);
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        return this.prisma.cabTrip.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                vehicle: true,
                driver: true,
                route: true,
                passengers: {
                    include: {
                        employee: {
                            include: {
                                user: {
                                    include: {
                                        department: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                shift: 'asc' // or pickupTime if available on trip, but it's on passenger assignment usually. Shift is a good proxy.
            }
        });
    }

    // --- Employee: View & Manage Ride ---

    async getEmployeeRide(userId: string, dateStr: string) {
        const date = new Date(dateStr);
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new NotFoundException('Employee not found');

        const assignment = await this.prisma.cabPassengerAssignment.findFirst({
            where: {
                employeeId: employee.id,
                cabTrip: {
                    date: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                }
            },
            include: {
                cabTrip: {
                    include: {
                        vehicle: true,
                        driver: true,
                        route: true,
                        passengers: {
                            include: {
                                employee: {
                                    select: { firstName: true, lastName: true, phone: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        // If no assignment, return null but also maybe available routes?
        return assignment || null;
    }

    async getAlternativeRides(routeId: string, dateStr: string) {
        const date = new Date(dateStr);
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        // Find all trips for this route on this day
        return this.prisma.cabTrip.findMany({
            where: {
                routeId: routeId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            include: {
                vehicle: true,
                driver: true,
                passengers: true // to check capacity
            }
        });
    }

    // --- Exception Handling ---

    async reportMissedCab(userId: string, body: { date: string, reason: string }) {
        const employee = await this.prisma.employee.findUnique({ where: { userId } });
        if (!employee) throw new NotFoundException('Employee not found');

        const ticket = await (this.prisma as any).cabTicket.create({
            data: {
                userId,
                date: new Date(body.date),
                reason: body.reason,
                status: TicketStatus.OPEN
            }
        });

        return ticket;
    }
}
