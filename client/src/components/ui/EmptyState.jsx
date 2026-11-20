/** Nothing to show yet, with a helpful next step. */
export default function EmptyState({ icon = '◇', title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-10 text-center ${className}`}>
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-xl border border-line-strong bg-surface-raised font-display text-lg text-accent"
      >
        {icon}
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
