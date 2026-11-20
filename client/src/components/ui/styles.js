/** Shared class builders for the UI components (kept apart for React Fast Refresh). */

const BASE =
  'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress';

const VARIANTS = {
  primary:
    'bg-accent-strong text-zinc-950 hover:bg-accent hover:shadow-glow active:translate-y-px active:bg-emerald-600',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-zinc-600 hover:bg-surface-raised active:translate-y-px',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink active:bg-zinc-700/60',
  danger: 'bg-red-500 text-white hover:bg-red-400 active:translate-y-px active:bg-red-600',
  'danger-outline':
    'border border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200 active:translate-y-px',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2.5 px-6 text-base',
  icon: 'size-9',
};

/** Classes for anything that should look like a button (e.g. a router <Link>). */
export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function fieldClasses(invalid, className = '') {
  return `block w-full rounded-lg border bg-canvas/60 px-3.5 py-2.5 text-ink transition placeholder:text-zinc-600 hover:border-zinc-600 focus:outline-none focus-visible:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
    invalid
      ? 'border-red-500/70 focus:ring-red-500/30'
      : 'border-line-strong focus:border-accent focus:ring-emerald-500/25'
  } ${className}`;
}

export const BADGE_TONES = {
  neutral: 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/30',
  accent: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  danger: 'bg-red-500/10 text-red-300 ring-red-500/30',
  warning: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  info: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  gold: 'bg-amber-400/15 text-amber-200 ring-amber-400/40',
};
