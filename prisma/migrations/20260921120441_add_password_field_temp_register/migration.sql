/*
  Warnings:

  - Added the required column `password` to the `TempRegistration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TempRegistration` ADD COLUMN `password` VARCHAR(191) NOT NULL;
