-- CreateIndex
CREATE INDEX `Match_player1Id_endedAt_idx` ON `Match`(`player1Id`, `endedAt`);

-- CreateIndex
CREATE INDEX `Match_player2Id_endedAt_idx` ON `Match`(`player2Id`, `endedAt`);

-- CreateIndex
CREATE INDEX `Submission_matchId_userId_createdAt_idx` ON `Submission`(`matchId`, `userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `User_elo_wins_createdAt_idx` ON `User`(`elo` DESC, `wins` DESC, `createdAt`);

