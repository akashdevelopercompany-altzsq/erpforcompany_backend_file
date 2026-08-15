import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'Superadmin@artibots.com';
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
        console.log(`VERIFICATION SUCCESS: User ${email} found.`);
        console.log(`Role: ${user.role}`);
    } else {
        console.log(`VERIFICATION FAILED: User ${email} NOT found.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
