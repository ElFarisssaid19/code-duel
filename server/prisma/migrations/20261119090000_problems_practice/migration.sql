-- AlterTable
ALTER TABLE `Problem` ADD COLUMN `functionName` JSON NOT NULL;

-- AlterTable
ALTER TABLE `Submission` ADD COLUMN `problemId` INTEGER NOT NULL,
    ADD COLUMN `status` ENUM('ACCEPTED', 'WRONG_ANSWER', 'RUNTIME_ERROR', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'COMPILE_ERROR', 'INTERNAL_ERROR') NOT NULL,
    ADD COLUMN `timeMs` INTEGER NULL;

-- AlterTable
ALTER TABLE `TestCase` ADD COLUMN `order` INTEGER NOT NULL,
    MODIFY `input` JSON NOT NULL,
    MODIFY `expectedOutput` JSON NOT NULL;

-- CreateIndex
CREATE INDEX `Submission_userId_problemId_idx` ON `Submission`(`userId`, `problemId`);

-- CreateIndex
CREATE INDEX `Submission_problemId_idx` ON `Submission`(`problemId`);

-- CreateIndex
CREATE UNIQUE INDEX `TestCase_problemId_order_key` ON `TestCase`(`problemId`, `order`);

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_problemId_fkey` FOREIGN KEY (`problemId`) REFERENCES `Problem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

