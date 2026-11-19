/** Display info for judge statuses (server: src/services/judge/statuses.js). */
export const VERDICTS = {
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  WRONG_ANSWER: { label: 'Wrong Answer', tone: 'danger' },
  RUNTIME_ERROR: { label: 'Runtime Error', tone: 'danger' },
  TIME_LIMIT_EXCEEDED: { label: 'Time Limit Exceeded', tone: 'warning' },
  MEMORY_LIMIT_EXCEEDED: { label: 'Memory Limit Exceeded', tone: 'warning' },
  COMPILE_ERROR: { label: 'Compile Error', tone: 'danger' },
  INTERNAL_ERROR: { label: 'Internal Error', tone: 'muted' },
  SKIPPED: { label: 'Skipped', tone: 'muted' },
};

export const TONE_CLASSES = {
  success: {
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  danger: {
    text: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/30',
    dot: 'bg-red-400',
  },
  warning: {
    text: 'text-amber-300',
    badge: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
    dot: 'bg-amber-300',
  },
  muted: {
    text: 'text-zinc-400',
    badge: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/30',
    dot: 'bg-zinc-500',
  },
};

export const verdictOf = (status) => VERDICTS[status] ?? { label: status, tone: 'muted' };

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
];
