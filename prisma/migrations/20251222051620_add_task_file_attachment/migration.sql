-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "storedFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_storedFileId_fkey" FOREIGN KEY ("storedFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
