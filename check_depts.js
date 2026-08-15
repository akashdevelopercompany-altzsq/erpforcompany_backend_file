const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.department.count();
    console.log(`Total Departments: ${count}`);
    const depts = await prisma.department.findMany();
    console.log('Departments:', depts);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
