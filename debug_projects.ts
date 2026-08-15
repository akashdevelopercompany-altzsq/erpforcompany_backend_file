
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const searchTerm = 'akash'; // Based on screenshot
    let output = `Searching for employee with name containing: ${searchTerm}\n`;

    const employees = await prisma.employee.findMany({
        where: {
            firstName: { contains: searchTerm, mode: 'insensitive' }
        },
        include: {
            user: true,
            teamMemberships: {
                include: {
                    team: {
                        include: {
                            project: true
                        }
                    }
                }
            }
        }
    });

    if (employees.length === 0) {
        output += 'No employee found.\n';
    } else {
        for (const emp of employees) {
            output += `\nEmployee: ${emp.firstName} ${emp.lastName}\n`;
            output += `ID: ${emp.id}\n`;
            output += `User ID: ${emp.userId}\n`;
            output += `Role: ${emp.user.role}\n`;
            output += `Department ID: ${emp.user.departmentId}\n`;

            output += '--- Assigned Projects (via Team) ---\n';
            if (emp.teamMemberships.length === 0) {
                output += 'No team memberships found.\n';
            } else {
                for (const tm of emp.teamMemberships) {
                    output += `- Project: ${tm.team.project.title} (Status: ${tm.team.project.status})\n`;
                    output += `  Team: ${tm.team.name} (Role: ${tm.role})\n`;
                }
            }
        }
    }

    fs.writeFileSync('debug_output.txt', output);
    console.log('Done writing to debug_output.txt');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
