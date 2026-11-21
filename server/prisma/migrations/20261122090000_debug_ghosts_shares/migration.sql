-- Phase 7: DEBUG category, ghost/bot matches (mode GHOST), share links.
-- Generated with `prisma migrate diff`; the DEBUG rating rows are a hand-written data step.
-- AlterTable
ALTER TABLE `Match` ADD COLUMN `botId` VARCHAR(32) NULL,
    ADD COLUMN `ghostSourceMatchId` INTEGER NULL,
    ADD COLUMN `ghostUserId` INTEGER NULL,
    ADD COLUMN `player1Lines` INTEGER NULL,
    ADD COLUMN `player2Lines` INTEGER NULL,
    ADD COLUMN `winnerIsGhost` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `player2Id` INTEGER NULL,
    MODIFY `mode` ENUM('RANKED', 'PRIVATE', 'GHOST') NOT NULL DEFAULT 'RANKED',
    MODIFY `category` ENUM('ALGO', 'FRONTEND', 'DEBUG') NOT NULL DEFAULT 'ALGO';

-- AlterTable
ALTER TABLE `Problem` ADD COLUMN `bugCount` INTEGER NULL,
    MODIFY `category` ENUM('ALGO', 'FRONTEND', 'DEBUG') NOT NULL DEFAULT 'ALGO';

-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `linesChanged` INTEGER NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `allowGhosts` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `UserRating` MODIFY `category` ENUM('ALGO', 'FRONTEND', 'DEBUG') NOT NULL;

-- Data: every existing user starts the DEBUG category at 1000.
INSERT INTO `UserRating` (`userId`, `category`) SELECT `id`, 'DEBUG' FROM `User`;

-- CreateTable
CREATE TABLE `MatchShare` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shareId` VARCHAR(32) NOT NULL,
    `matchId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MatchShare_shareId_key`(`shareId`),
    INDEX `MatchShare_userId_idx`(`userId`),
    UNIQUE INDEX `MatchShare_matchId_userId_key`(`matchId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Match_mode_status_category_idx` ON `Match`(`mode`, `status`, `category`);

-- CreateIndex
CREATE INDEX `Match_ghostUserId_idx` ON `Match`(`ghostUserId`);

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_ghostUserId_fkey` FOREIGN KEY (`ghostUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchShare` ADD CONSTRAINT `MatchShare_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchShare` ADD CONSTRAINT `MatchShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

