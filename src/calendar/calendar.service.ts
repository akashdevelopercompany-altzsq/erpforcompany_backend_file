import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
    constructor(private prisma: PrismaService) { }

    async getHolidays(start: Date, end: Date) {
        return this.prisma.calendarEvent.findMany({
            where: {
                date: { gte: start, lte: end },
                type: { in: ['HOLIDAY', 'SHUTDOWN'] },
            },
        });
    }

    async isHoliday(date: Date): Promise<boolean> {
        const formattedDate = new Date(date);
        formattedDate.setHours(0, 0, 0, 0);
        // Note: Dates in DB should probably be stored as midnight UTC or handled consistently.
        // For now, assuming date equality check via range or strict match if stored consistently.
        // Better: check range for the day.
        const nextDay = new Date(formattedDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const event = await this.prisma.calendarEvent.findFirst({
            where: {
                date: { gte: formattedDate, lt: nextDay },
                type: { in: ['HOLIDAY', 'SHUTDOWN'] },
            },
        });
        return !!event;
    }

    // Seeder helper (optional)
    async seedHolidays(year: number) {
        // Basic India/Global holidays
        const holidays = [
            { date: new Date(year, 0, 1), title: 'New Year' },
            { date: new Date(year, 0, 26), title: 'Republic Day' },
            { date: new Date(year, 7, 15), title: 'Independence Day' },
            { date: new Date(year, 9, 2), title: 'Gandhi Jayanti' },
            { date: new Date(year, 11, 25), title: 'Christmas' },
        ];

        for (const h of holidays) {
            const exists = await this.isHoliday(h.date);
            if (!exists) {
                await this.prisma.calendarEvent.create({
                    data: {
                        title: h.title,
                        date: h.date,
                        type: 'HOLIDAY'
                    }
                });
            }
        }
    }
}
