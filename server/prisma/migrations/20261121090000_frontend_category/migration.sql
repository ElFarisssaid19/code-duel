-- Phase 6: FRONTEND category (HTML/CSS problems scored by pixel comparison) and separate ratings
-- per category. Generated with `prisma migrate diff`, then reordered by hand so the existing
-- ratings are copied into UserRating BEFORE the old User columns are dropped.

-- AlterTable
ALTER TABLE `Match` ADD COLUMN `category` ENUM('ALGO', 'FRONTEND') NOT NULL DEFAULT 'ALGO',
    ADD COLUMN `player1Chars` INTEGER NULL,
    ADD COLUMN `player1Score` DECIMAL(5, 2) NULL,
    ADD COLUMN `player2Chars` INTEGER NULL,
    ADD COLUMN `player2Score` DECIMAL(5, 2) NULL,
    ADD COLUMN `track` ENUM('HTML', 'CSS', 'HTML_CSS') NULL;

-- AlterTable
ALTER TABLE `Problem` ADD COLUMN `canvasHeight` INTEGER NULL,
    ADD COLUMN `canvasWidth` INTEGER NULL,
    ADD COLUMN `category` ENUM('ALGO', 'FRONTEND') NOT NULL DEFAULT 'ALGO',
    ADD COLUMN `fixedHtml` TEXT NULL,
    ADD COLUMN `matchThreshold` DECIMAL(5, 2) NULL,
    ADD COLUMN `palette` JSON NULL,
    ADD COLUMN `referenceCss` TEXT NULL,
    ADD COLUMN `referenceHtml` TEXT NULL,
    ADD COLUMN `targetImagePath` VARCHAR(255) NULL,
    ADD COLUMN `track` ENUM('HTML', 'CSS', 'HTML_CSS') NULL,
    MODIFY `functionName` JSON NULL;

-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `charCount` INTEGER NULL,
    ADD COLUMN `css` TEXT NULL,
    ADD COLUMN `score` DECIMAL(5, 2) NULL;

-- CreateTable
CREATE TABLE `UserRating` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `category` ENUM('ALGO', 'FRONTEND') NOT NULL,
    `elo` INTEGER NOT NULL DEFAULT 1000,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `bestElo` INTEGER NOT NULL DEFAULT 1000,

    INDEX `UserRating_category_elo_wins_idx`(`category`, `elo` DESC, `wins` DESC),
    UNIQUE INDEX `UserRating_userId_category_key`(`userId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Data: every existing user keeps their ELO and W/L/D as their ALGO rating. bestElo is the
-- highest of 1000 (start), the current ELO and every ELO reached after a finished ranked match.
INSERT INTO `UserRating` (`userId`, `category`, `elo`, `wins`, `losses`, `draws`, `bestElo`)
SELECT u.`id`, 'ALGO', u.`elo`, u.`wins`, u.`losses`, u.`draws`,
       GREATEST(1000, u.`elo`, COALESCE((
         SELECT MAX(CASE WHEN m.`player1Id` = u.`id`
                         THEN m.`player1Elo` + m.`player1EloChange`
                         ELSE m.`player2Elo` + m.`player2EloChange` END)
         FROM `Match` m
         WHERE m.`mode` = 'RANKED' AND m.`status` = 'FINISHED'
           AND m.`player1EloChange` IS NOT NULL
           AND (m.`player1Id` = u.`id` OR m.`player2Id` = u.`id`)
       ), 0))
FROM `User` u;

-- Everyone starts the FRONTEND category at 1000.
INSERT INTO `UserRating` (`userId`, `category`) SELECT `id`, 'FRONTEND' FROM `User`;

-- DropIndex
DROP INDEX `User_elo_wins_createdAt_idx` ON `User`;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `draws`,
    DROP COLUMN `elo`,
    DROP COLUMN `losses`,
    DROP COLUMN `wins`;

-- CreateIndex
CREATE INDEX `Problem_category_difficulty_idx` ON `Problem`(`category`, `difficulty`);

-- AddForeignKey
ALTER TABLE `UserRating` ADD CONSTRAINT `UserRating_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
