/*
  Warnings:

  - A unique constraint covering the columns `[sourceUrl]` on the table `Competition` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Competition` ADD COLUMN `sourceUrl` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Profile` ADD COLUMN `cvPath` VARCHAR(255) NULL,
    ADD COLUMN `fotoProfilUrl` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `TeamBlacklist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teamId` INTEGER NOT NULL,
    `blockedUserId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeamBlacklist_blockedUserId_idx`(`blockedUserId`),
    UNIQUE INDEX `TeamBlacklist_teamId_blockedUserId_key`(`teamId`, `blockedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Competition_sourceUrl_key` ON `Competition`(`sourceUrl`);

-- AddForeignKey
ALTER TABLE `TeamBlacklist` ADD CONSTRAINT `TeamBlacklist_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamBlacklist` ADD CONSTRAINT `TeamBlacklist_blockedUserId_fkey` FOREIGN KEY (`blockedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamBlacklist` ADD CONSTRAINT `TeamBlacklist_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
