import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';

const YOU = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) {
      return [seen.get(need), i];
    }
    seen.set(nums[i], i);
  }
}`;

const RIVAL = `def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    # TODO: too slow?`;

const CYCLE_MS = 14_000;
const TESTS = 9;

/** Fake duel for the landing page: two editors typing, progress bars, a ticking timer. No data. */
export default function MockDuel() {
  const reducedMotion = useReducedMotion();
  const [t, setT] = useState(reducedMotion ? CYCLE_MS - 1500 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    const id = setInterval(() => setT((performance.now() - start) % CYCLE_MS), 90);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const time = reducedMotion ? CYCLE_MS - 1500 : t;
  const typed = (code, msPerChar, delay = 0) =>
    code.slice(0, Math.max(0, Math.floor((time - delay) / msPerChar)));
  const you = typed(YOU, 38);
  const rival = typed(RIVAL, 52, 600);
  const yourPassed = Math.min(TESTS, Math.max(0, Math.floor((time - 8500) / 380)));
  const rivalPassed = Math.min(5, Math.max(0, Math.floor((time - 9000) / 700)));
  const won = yourPassed === TESTS;
  const remaining = Math.max(0, 300 - Math.floor(time / 1000) * 7);

  return (
    <div
      className="relative rounded-2xl border border-line-strong bg-surface/90 p-3 shadow-card sm:p-4"
      aria-hidden="true"
    >
      <div className="mb-3 flex items-center gap-3">
        <Bar label="you" passed={yourPassed} accent="emerald" />
        <div
          className={`font-mono text-2xl font-bold tabular-nums ${remaining < 60 ? 'text-red-300' : 'text-ink'}`}
        >
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </div>
        <Bar label="rival" passed={rivalPassed} accent="sky" right />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Editor code={you} file="solution.js" cursor={!won} />
        <Editor code={rival} file="solution.py" cursor={!won} rival />
      </div>
      {won && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <span className="rounded-full border border-emerald-500/40 bg-canvas/90 px-4 py-1.5 font-display text-sm font-bold tracking-wide text-emerald-300 uppercase shadow-glow motion-safe:animate-pop-in">
            Victory · +16 ELO
          </span>
        </div>
      )}
    </div>
  );
}

function Bar({ label, passed, accent, right }) {
  const color = accent === 'emerald' ? 'bg-emerald-400' : 'bg-sky-400';
  return (
    <div className={`min-w-0 flex-1 space-y-1 ${right ? 'text-right' : ''}`}>
      <p className={`font-mono text-[0.7rem] text-ink-muted ${right ? '' : ''}`}>
        {label} · {passed}/{TESTS}
      </p>
      <div
        className={`h-1.5 overflow-hidden rounded-full bg-zinc-800 ${right ? 'rotate-180' : ''}`}
      >
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${(passed / TESTS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Editor({ code, file, cursor, rival }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
        <span className={`size-2 rounded-full ${rival ? 'bg-sky-400' : 'bg-emerald-400'}`} />
        <span className="font-mono text-[0.65rem] text-ink-subtle">{file}</span>
      </div>
      <pre className="h-44 overflow-hidden p-2.5 font-mono text-[0.58rem] leading-relaxed whitespace-pre text-zinc-300 sm:h-52 sm:text-[0.68rem]">
        {code}
        {cursor && (
          <span className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent" />
        )}
      </pre>
    </div>
  );
}
