/*
  Warnings:

  - You are about to drop the column `attachmentData` on the `SupportTicket` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentName` on the `SupportTicket` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentType` on the `SupportTicket` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SupportTicket" DROP COLUMN "attachmentData",
DROP COLUMN "attachmentName",
DROP COLUMN "attachmentType";
