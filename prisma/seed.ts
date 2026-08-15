import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@artibots.com' },
        update: {},
        create: {
            email: 'admin@artibots.com',
            password: hashedPassword,
            role: Role.ADMIN,
        },
    });

    const superAdmin = await prisma.user.upsert({
        where: { email: 'superadmin@artibots.com' },
        update: {},
        create: {
            email: 'superadmin@artibots.com',
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
        },
    });

    // Create Employee Profiles
    await prisma.employee.upsert({
        where: { userId: admin.id },
        update: {},
        create: {
            userId: admin.id,
            firstName: 'System',
            lastName: 'Administrator',
            gender: 'MALE',
            jobTitle: 'Admin',
            phone: '1234567890'
        }
    });

    await prisma.employee.upsert({
        where: { userId: superAdmin.id },
        update: {},
        create: {
            userId: superAdmin.id,
            firstName: 'Super',
            lastName: 'Admin',
            gender: 'FEMALE',
            jobTitle: 'Super Admin',
            phone: '0987654321'
        }
    });

    console.log({ admin, superAdmin });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
