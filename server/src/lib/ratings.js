/** Per-category ratings (UserRating rows). A missing row means the starting defaults. */
export const CATEGORIES = ['ALGO', 'FRONTEND', 'DEBUG'];
/** Categories judged by go-judge (function-style problems with tests). */
export const JUDGED_CATEGORIES = ['ALGO', 'DEBUG'];
export const TRACKS = ['HTML', 'CSS', 'HTML_CSS'];
export const START_ELO = 1000;

export const ratingSelect = {
  category: true,
  elo: true,
  wins: true,
  losses: true,
  draws: true,
  bestElo: true,
};

export const defaultRating = () => ({
  elo: START_ELO,
  wins: 0,
  losses: 0,
  draws: 0,
  bestElo: START_ELO,
});

/** [{ category, elo, … }] → { ALGO: { elo, wins, losses, draws, bestElo }, FRONTEND: { … } } */
export function ratingsByCategory(rows = []) {
  const ratings = Object.fromEntries(CATEGORIES.map((c) => [c, defaultRating()]));
  for (const { category, ...rating } of rows) ratings[category] = { ...defaultRating(), ...rating };
  return ratings;
}

/** Both rating rows, for prisma.user.create({ data: { ratings: newRatingRows } }). */
export const newRatingRows = { create: CATEGORIES.map((category) => ({ category })) };
