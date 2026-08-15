-- CreateEnum
CREATE TYPE "EfficiencyPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "shiftEndTime" TEXT DEFAULT '18:00';

-- AlterTable
ALTER TABLE "PerformanceReport" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "submissionDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EfficiencyRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" "EfficiencyPeriod" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EfficiencyRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EfficiencyRecord" ADD CONSTRAINT "EfficiencyRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
