-- Phase 7: ghost matches point to the ranked match whose run they replay.
-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_ghostSourceMatchId_fkey` FOREIGN KEY (`ghostSourceMatchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

