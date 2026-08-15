-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "isAutoApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "PerformanceReport" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "reviewerId" TEXT;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "TaskSubmission" ADD COLUMN     "fileUrl" TEXT;

-- AddForeignKey
ALTER TABLE "PerformanceReport" ADD CONSTRAINT "PerformanceReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
