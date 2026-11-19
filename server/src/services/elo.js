/** Elo ratings (ranked matches only). */

export const K_FACTOR = 32;

/** Probability that a player rated `rating` beats one rated `opponentRating`. */
export function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/**
 * Rating changes after a game between A and B. scoreA: 1 = A won, 0.5 = draw, 0 = A lost.
 * Rounded to integers and zero-sum (B loses exactly what A gains).
 */
export function calculateEloChange(ratingA, ratingB, scoreA, k = K_FACTOR) {
  const a = Math.round(k * (scoreA - expectedScore(ratingA, ratingB))) || 0; // no -0
  return { a, b: -a || 0 };
}
