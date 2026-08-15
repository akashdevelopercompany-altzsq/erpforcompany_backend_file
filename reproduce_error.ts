import { PrismaClient, Role } from '@prisma/client';
import { LeaveService } from './src/leave/leave.service';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Mock NotificationsService
const mockNotificationsService = {
    createAndBroadcast: async () => ({ count: 0 }),
    findForUser: async () => [],
    markRead: async () => { },
} as any;

const leaveService = new LeaveService(prisma as any, mockNotificationsService);

async function main() {
    console.log('--- Starting Reproduction Script ---');

    // 1. Test with SUPER_ADMIN
    try {
        console.log('\nTesting SUPER_ADMIN...');
        const superAdminUser = { id: 'sa', role: Role.SUPER_ADMIN, departmentId: null };
        const leaves = await leaveService.findAll(superAdminUser);
        console.log(`SUPER_ADMIN fetched ${leaves.length} leaves.`);
    } catch (err) {
        console.error('SUPER_ADMIN failed:', err);
        fs.writeFileSync('reproduction_error.log', `SUPER_ADMIN Error: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`);
    }

    // 2. Test with ADMIN
    try {
        console.log('\nTesting ADMIN...');
        // Find a user who is an admin
        const adminUser = await prisma.user.findFirst({
            where: { role: Role.ADMIN },
            include: { department: true }
        });

        if (adminUser) {
            console.log(`Found admin: ${adminUser.email} (Dept: ${adminUser.departmentId})`);
            const leaves = await leaveService.findAll(adminUser);
            console.log(`ADMIN fetched ${leaves.length} leaves.`);
        } else {
            console.log('No ADMIN user found in DB to test.');
            // Try to fake one 
            const dept = await prisma.department.findFirst();
            if (dept) {
                const fakeAdmin = { id: 'fake', role: Role.ADMIN, departmentId: dept.id };
                const leaves = await leaveService.findAll(fakeAdmin);
                console.log(`Fake ADMIN fetched ${leaves.length} leaves.`);
            }
        }
    } catch (err) {
        console.error('ADMIN failed:', err);
        fs.writeFileSync('reproduction_error.log', `ADMIN Error: ${JSON.stringify(err, Object.getOwnPropertyNames(err), 2)}`, { flag: 'a' });
    }

    console.log('\n--- Finished ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
