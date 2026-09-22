/*
  Warnings:

  - You are about to drop the column `attempt` on the `TempRegistration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `TempRegistration` DROP COLUMN `attempt`,
    ADD COLUMN `attemptCode` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `attemptResend` INTEGER NOT NULL DEFAULT 0;
