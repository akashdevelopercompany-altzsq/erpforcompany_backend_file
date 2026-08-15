
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Connecting to database...');
        // Log masked URL to verify protocol/host without exposing credentials
        const url = process.env.DATABASE_URL || '';
        const maskedUrl = url.replace(/:([^@]+)@/, ':****@');
        console.log(`Database URL: ${maskedUrl}`);

        const count = await prisma.message.count();
        console.log(`Total Messages in Database: ${count}`);

        const lastMessage = await prisma.message.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (lastMessage) {
            console.log('Last Message:', lastMessage);
        } else {
            console.log('No messages found.');
        }
    } catch (error) {
        console.error('Error connecting to database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
