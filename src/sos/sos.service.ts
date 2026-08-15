import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SosGateway } from './sos.gateway';
import { CreateSosDto } from './dto/create-sos.dto';
import { UpdateSosLocationDto } from './dto/update-location.dto';
import { SosStatus } from '@prisma/client';

@Injectable()
export class SosService {
    private readonly logger = new Logger(SosService.name);

    constructor(
        private prisma: PrismaService,
        private sosGateway: SosGateway,
    ) { }

    async create(userId: string, createSosDto: CreateSosDto) {
        try {
            // 1. Find Employee
            const employee = await this.prisma.employee.findUnique({
                where: { userId },
                include: { user: true },
            });

            if (!employee) {
                this.logger.error(`SOS Trigger Failed: No Employee profile found for User ID ${userId}`);
                // If user has no employee profile, we cannot create an SOS incident due to schema constraints.
                throw new BadRequestException('Employee profile validation failed: You must have an employee profile to trigger SOS.');
            }

            // 2. Detect active Cab Trip (simplified)
            // const activeTrip = ...

            // 3. Create Incident
            const incident = await this.prisma.sosIncident.create({
                data: {
                    employeeId: employee.id,
                    source: createSosDto.source,
                    message: createSosDto.message,
                    initialLat: createSosDto.latitude,
                    initialLong: createSosDto.longitude,
                    lastLat: createSosDto.latitude,
                    lastLong: createSosDto.longitude,
                    status: 'ACTIVE',
                    locationLogs: createSosDto.latitude && createSosDto.longitude ? {
                        create: {
                            latitude: createSosDto.latitude,
                            longitude: createSosDto.longitude,
                        }
                    } : undefined,
                },
                include: {
                    employee: true,
                }
            });

            // 4. Notify via Gateway
            this.sosGateway.notifySosTriggered(incident);
            this.logger.log(`SOS Triggered by ${employee.firstName} ${employee.lastName}`);

            return incident;
        } catch (error) {
            this.logger.error('Error creating SOS incident', error.stack);
            throw error;
        }
    }

    async updateLocation(incidentId: string, updateLocationDto: UpdateSosLocationDto) {
        const incident = await this.prisma.sosIncident.update({
            where: { id: incidentId },
            data: {
                lastLat: updateLocationDto.latitude,
                lastLong: updateLocationDto.longitude,
                locationLogs: {
                    create: {
                        latitude: updateLocationDto.latitude,
                        longitude: updateLocationDto.longitude,
                    }
                }
            },
            include: { employee: true }
        });

        this.sosGateway.notifySosUpdate(incident);
        return incident;
    }

    async findAll() {
        return this.prisma.sosIncident.findMany({
            include: {
                employee: {
                    include: {
                        user: {
                            select: {
                                email: true,
                                role: true,
                                department: {
                                    select: {
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                },
                locationLogs: {
                    orderBy: { capturedAt: 'desc' },
                    take: 50 // Get last 50 location updates for tracking
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateStatus(id: string, status: SosStatus, resolutionNotes?: string) {
        const incident = await this.prisma.sosIncident.update({
            where: { id },
            data: {
                status,
                message: resolutionNotes ? resolutionNotes : undefined, // appending notes to message or separate field? Schema has message.
                resolvedAt: status === 'RESOLVED' || status === 'FALSE_ALARM' ? new Date() : undefined,
            },
            include: { employee: true }
        });
        this.sosGateway.notifySosUpdate(incident);
        return incident;
    }
}
