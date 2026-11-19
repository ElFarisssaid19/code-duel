-- AlterTable
ALTER TABLE `Match` DROP COLUMN `eloChange`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `durationMs` INTEGER NOT NULL,
    ADD COLUMN `endReason` ENUM('SOLVED', 'TIMEOUT', 'FORFEIT', 'DISCONNECT', 'CANCELLED') NULL,
    ADD COLUMN `endsAt` DATETIME(3) NULL,
    ADD COLUMN `mode` ENUM('RANKED', 'PRIVATE') NOT NULL DEFAULT 'RANKED',
    ADD COLUMN `player1Elo` INTEGER NOT NULL,
    ADD COLUMN `player1EloChange` INTEGER NULL,
    ADD COLUMN `player1Passed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `player1ReachedAt` DATETIME(3) NULL,
    ADD COLUMN `player2Elo` INTEGER NOT NULL,
    ADD COLUMN `player2EloChange` INTEGER NULL,
    ADD COLUMN `player2Passed` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `player2ReachedAt` DATETIME(3) NULL,
    ADD COLUMN `roomCode` VARCHAR(6) NULL,
    ADD COLUMN `testCount` INTEGER NOT NULL,
    MODIFY `status` ENUM('WAITING', 'COUNTDOWN', 'ACTIVE', 'FINISHED', 'CANCELLED') NOT NULL DEFAULT 'WAITING';

-- CreateIndex
CREATE INDEX `Match_player1Id_createdAt_idx` ON `Match`(`player1Id`, `createdAt`);

-- CreateIndex
CREATE INDEX `Match_player2Id_createdAt_idx` ON `Match`(`player2Id`, `createdAt`);

