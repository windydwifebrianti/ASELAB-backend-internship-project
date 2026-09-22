/*
  Warnings:

  - You are about to drop the column `jurusan` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `minat` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pengalamanLomba` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `skill` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `jurusan`,
    DROP COLUMN `minat`,
    DROP COLUMN `pengalamanLomba`,
    DROP COLUMN `skill`,
    ADD COLUMN `password` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `jurusan` VARCHAR(191) NULL,
    `skill` JSON NULL,
    `minat` JSON NULL,
    `pengalamanLomba` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
