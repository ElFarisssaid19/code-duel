import Button from '@/components/ui/Button.jsx';

/** A request failed: explain and offer a retry. */
export default function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-8 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-red-500/15 font-display text-lg font-bold text-red-300"
      >
        !
      </span>
      <p className="font-display font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
