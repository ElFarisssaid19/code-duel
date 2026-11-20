-- AlterTable
ALTER TABLE `User` ADD COLUMN `preferredLanguage` VARCHAR(16) NOT NULL DEFAULT 'javascript',
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0;

