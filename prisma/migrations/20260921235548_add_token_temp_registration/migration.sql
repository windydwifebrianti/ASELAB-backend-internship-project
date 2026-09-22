/*
  Warnings:

  - A unique constraint covering the columns `[nim]` on the table `TempRegistration` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[token]` on the table `TempRegistration` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `TempRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TempRegistration` ADD COLUMN `token` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `TempRegistration_nim_key` ON `TempRegistration`(`nim`);

-- CreateIndex
CREATE UNIQUE INDEX `TempRegistration_token_key` ON `TempRegistration`(`token`);
