/**
 * Share links and result cards.
 *
 * POST /api/matches/:id/share creates (or returns) the sharer's link for a FINISHED match they
 * played: one unguessable shareId (128 random bits) per user per match. DELETE revokes it (the
 * row and the cached cards are deleted, so the public URLs 404). Cards are rendered by the
 * renderer service from a trusted template and cached on disk (<DATA_DIR>/cards/), regenerated
 * when missing.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { dataDir } from '../frontend/targets.js';
import { renderPage } from '../renderer/index.js';
import { buildCard, CARD_FORMATS } from './cardTemplate.js';
import { buildSharePage } from './page.js';
import { buildShareSummary } from './summary.js';

export { CARD_FORMATS };

const appUrl = () => env.APP_URL.replace(/\/+$/, '');
export const shareUrl = (shareId) => `${appUrl()}/s/${shareId}`;
export const cardUrl = (shareId, format) =>
  `${appUrl()}/api/share/${shareId}/card.png?format=${format}`;
export const newShareId = () => randomBytes(16).toString('base64url'); // 22 chars
export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const cardsDir = () => join(dataDir(), 'cards');
const cardPath = (shareId, format) => join(cardsDir(), `${shareId}-${format}.png`);

const view = (share) => ({
  shareId: share.shareId,
  url: shareUrl(share.shareId),
  cards: Object.fromEntries(Object.keys(CARD_FORMATS).map((f) => [f, cardUrl(share.shareId, f)])),
  createdAt: share.createdAt,
});

async function shareableMatch(matchId, userId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { status: true, player1Id: true, player2Id: true },
  });
  if (!match) throw new HttpError(404, 'NOT_FOUND', 'Match not found');
  if (match.player1Id !== userId && match.player2Id !== userId) {
    throw new HttpError(403, 'NOT_A_PARTICIPANT', 'Only the players can share this match.');
  }
  if (match.status !== 'FINISHED') {
    throw new HttpError(403, 'MATCH_NOT_FINISHED', 'Only finished matches can be shared.');
  }
  return match;
}

/** Creates (or returns) the user's share link for a match, and pre-renders the link preview card. */
export async function createShare(matchId, userId) {
  await shareableMatch(matchId, userId);
  const where = { matchId_userId: { matchId, userId } };
  let share = await prisma.matchShare.findUnique({ where });
  if (!share) {
    try {
      share = await prisma.matchShare.create({ data: { matchId, userId, shareId: newShareId() } });
    } catch (err) {
      // Two concurrent requests (double click, React StrictMode): the other one created it.
      if (err?.code !== 'P2002') throw err;
      share = await prisma.matchShare.findUnique({ where });
    }
  }
  await getCard(share.shareId, 'og');
  return view(share);
}

/** The user's current share link for a match, or null. */
export async function getShare(matchId, userId) {
  await shareableMatch(matchId, userId);
  const share = await prisma.matchShare.findUnique({
    where: { matchId_userId: { matchId, userId } },
  });
  return share && view(share);
}

/** Revokes the link: deletes the row and the cached cards. */
export async function revokeShare(matchId, userId) {
  const share = await prisma.matchShare.findUnique({
    where: { matchId_userId: { matchId, userId } },
  });
  if (!share) return false;
  await prisma.matchShare.delete({ where: { id: share.id } });
  await Promise.all(
    Object.keys(CARD_FORMATS).map((f) => rm(cardPath(share.shareId, f), { force: true })),
  );
  return true;
}

/** The share summary for a public shareId, or null (unknown / revoked). */
async function loadSummary(shareId) {
  if (!SHARE_ID_PATTERN.test(shareId)) return null;
  const share = await prisma.matchShare.findUnique({
    where: { shareId },
    include: {
      match: {
        include: {
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
          ghostUser: { select: { id: true, username: true } },
          ghostSourceMatch: { select: { endedAt: true } },
          problem: { select: { title: true, difficulty: true } },
        },
      },
    },
  });
  if (!share || share.match.status !== 'FINISHED') return null;
  return buildShareSummary(share.match, share.userId);
}

/** GET /s/:shareId → HTML, or null. */
export async function getSharePage(shareId) {
  const summary = await loadSummary(shareId);
  return summary && buildSharePage(summary, { shareId, appUrl: appUrl() });
}

const inFlight = new Map(); // `${shareId}:${format}` → Promise<Buffer> (one render at a time)

/** The card PNG: from the disk cache, else rendered (once, even with concurrent requests). */
export async function getCard(shareId, format) {
  if (!CARD_FORMATS[format])
    throw new HttpError(400, 'VALIDATION_ERROR', 'format must be og or story');
  const key = `${shareId}:${format}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const work = (async () => {
    const summary = await loadSummary(shareId);
    if (!summary) return null;
    const path = cardPath(shareId, format);
    const cached = await readFile(path).catch(() => null);
    if (cached) return cached;
    const card = buildCard(summary, format, { appHost: new URL(appUrl()).host });
    const png = await renderPage(card);
    await mkdir(cardsDir(), { recursive: true });
    await writeFile(path, png);
    return png;
  })();
  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}
