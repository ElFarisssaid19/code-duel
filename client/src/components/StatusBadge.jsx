import { TONE_CLASSES, verdictOf } from '@/lib/verdicts.js';

/** Judge verdict pill, e.g. "Accepted" in green. */
export default function StatusBadge({ status }) {
  const { label, tone } = verdictOf(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone].badge}`}
    >
      {label}
    </span>
  );
}
