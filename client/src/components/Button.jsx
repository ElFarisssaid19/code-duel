import Spinner from '@/components/Spinner.jsx';

const VARIANTS = {
  primary: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 focus-visible:outline-emerald-400',
  secondary:
    'border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 focus-visible:outline-zinc-500',
};

export default function Button({
  children,
  loading = false,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
