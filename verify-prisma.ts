
import { PrismaClient, FileCategory } from '@prisma/client';

console.log('FileCategory:', FileCategory);
const prisma = new PrismaClient();
prisma.$disconnect();
