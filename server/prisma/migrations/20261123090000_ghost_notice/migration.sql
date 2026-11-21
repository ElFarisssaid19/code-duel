-- Ghost replay notice: existing users see a one-time banner on Home until they dismiss it (null).
-- AlterTable
ALTER TABLE `User` ADD COLUMN `ghostNoticeDismissedAt` DATETIME(3) NULL;

