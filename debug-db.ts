import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany();
        console.log('--- USER LIST ---');
        users.forEach(u => {
            console.log(`EMAIL: ${u.email} | ROLE: ${u.role}`);
        });
        console.log('-----------------');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
