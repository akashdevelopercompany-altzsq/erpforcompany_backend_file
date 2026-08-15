import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        include: {
            employee: true
        }
    });

    let output = "List of Users:\n";
    output += "====================================================================================================\n";
    output +=
        "Email".padEnd(35) +
        " | " + "Role".padEnd(15) +
        " | " + "Employee Name".padEnd(25) +
        " | " + "Password (Hashed)\n";
    output += "----------------------------------------------------------------------------------------------------\n";

    users.forEach(user => {
        const empName = user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : "N/A";
        output +=
            user.email.padEnd(35) +
            " | " + user.role.padEnd(15) +
            " | " + empName.padEnd(25) +
            " | " + user.password.substring(0, 15) + "...\n";
    });
    output += "====================================================================================================\n";

    fs.writeFileSync('users_list.txt', output);
    console.log("Output written to users_list.txt");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
