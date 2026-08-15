import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            role: true,
            departmentId: true
        }
    });

    console.log('Users found:', users);

    const superAdmin = users.find(u => u.role === 'SUPER_ADMIN');
    if (superAdmin) {
        console.log('Super Admin exists:', superAdmin.email);
    } else {
        console.log('No Super Admin found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
