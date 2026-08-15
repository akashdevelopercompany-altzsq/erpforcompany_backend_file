import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.department.findMany({
            include: {
                users: true,
                projects: true
            }
        });
    }

    async findOne(id: string) {
        return this.prisma.department.findUnique({
            where: { id },
            include: { users: true, projects: true },
        });
    }

    async create(data: { name: string }) {
        try {
            return await this.prisma.department.create({
                data,
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException(`Department with name "${data.name}" already exists`);
            }
            throw error;
        }
    }
}
