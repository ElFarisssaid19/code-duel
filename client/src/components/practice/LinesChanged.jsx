import { useMemo } from 'react';
import { linesLabel } from '@/lib/categories.js';
import { linesChanged } from '@/lib/linesChanged.js';

/** DEBUG: live "N lines changed" vs the buggy code (same diff as the server). */
export default function LinesChanged({ original, code }) {
  const count = useMemo(() => linesChanged(original, code), [original, code]);
  return (
    <span
      className={`rounded-md border px-2 py-1 font-mono text-xs ${count === 0 ? 'border-line text-ink-subtle' : 'border-amber-400/40 bg-amber-400/10 text-amber-100'}`}
      data-testid="lines-changed"
      aria-live="polite"
      title="Lines changed compared to the buggy code (fewer wins a tie)"
    >
      {linesLabel(count)} changed
    </span>
  );
}
