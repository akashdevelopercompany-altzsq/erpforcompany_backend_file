import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@artibots.com';
    const newPassword = 'password123';

    console.log(`Resetting password for ${email}...`);

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const user = await prisma.user.update({
            where: { email },
            data: { password: hashedPassword },
        });

        console.log(`SUCCESS: Password for ${email} has been reset to '${newPassword}'`);
        console.log(`New Hash: ${user.password}`);
    } catch (error) {
        console.error(`ERROR: Could not reset password. User might not exist.`);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
