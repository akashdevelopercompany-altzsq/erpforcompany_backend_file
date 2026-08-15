import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // This should fail compilation if types are wrong
    const user = await prisma.user.findFirst();
    if (user) {
        console.log(user.email);
        console.log(user.departmentId);
    }
    console.log('Prisma Client is working');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
