-- AlterTable
ALTER TABLE "CallSession" ADD COLUMN     "duration" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileType" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "storedFileId" TEXT;
