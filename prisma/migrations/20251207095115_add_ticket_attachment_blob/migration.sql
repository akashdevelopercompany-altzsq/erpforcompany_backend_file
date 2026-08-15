-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "attachmentData" BYTEA,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentType" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;

-- CreateTable
CREATE TABLE "TaskDailyReport" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "hoursSpent" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDailyReport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskDailyReport" ADD CONSTRAINT "TaskDailyReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyReport" ADD CONSTRAINT "TaskDailyReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
