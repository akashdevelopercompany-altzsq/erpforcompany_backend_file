-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "payload" JSONB,
ADD COLUMN     "referenceId" TEXT,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "body" DROP NOT NULL;
