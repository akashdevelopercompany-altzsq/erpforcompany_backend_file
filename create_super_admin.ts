import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'Superadmin@artibots.com';
    const password = 'SuperAdmin#Artibots_in';
    const departmentName = 'Management';

    console.log(`Creating Super Admin...`);
    console.log(`Email: ${email}`);
    console.log(`Department: ${departmentName}`);

    // 1. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Find or Create Department
    let department = await prisma.department.findUnique({ where: { name: departmentName } });
    if (!department) {
        console.log(`Department '${departmentName}' not found. Creating it...`);
        department = await prisma.department.create({ data: { name: departmentName } });
    } else {
        console.log(`Department '${departmentName}' already exists.`);
    }

    // 3. Create User
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        console.log(`User ${email} already exists. Deleting...`);
        await prisma.user.delete({ where: { email } });
        console.log('User deleted successfully.');
    }

    console.log('Creating new user...');
    await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            role: Role.SUPER_ADMIN,
            departmentId: department.id
        }
    });
    console.log('User created successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
