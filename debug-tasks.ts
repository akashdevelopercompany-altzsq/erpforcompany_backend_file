
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.task.count();
    console.log(`Total tasks in DB: ${count}`);

    const tasks = await prisma.task.findMany({
        take: 5,
        include: { employee: true }
    });
    console.log('Sample tasks:', JSON.stringify(tasks, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
