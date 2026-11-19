const STYLES = {
  EASY: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
  MEDIUM: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
  HARD: 'bg-red-500/10 text-red-400 ring-red-500/30',
};
const LABELS = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

export default function DifficultyBadge({ difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[difficulty] ?? STYLES.EASY}`}
    >
      {LABELS[difficulty] ?? difficulty}
    </span>
  );
}
