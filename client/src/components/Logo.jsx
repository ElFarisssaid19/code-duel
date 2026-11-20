/** Wordmark: angular bracket mark + "Code Duel" in the display font. */
export default function Logo({ className = 'text-lg', mark = true }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-bold tracking-tight ${className}`}
    >
      {mark && (
        <svg viewBox="0 0 32 32" className="size-[1.25em]" aria-hidden="true">
          <path
            d="M13 7 5 16l8 9"
            fill="none"
            stroke="#34eaa2"
            strokeWidth="3.5"
            strokeLinecap="square"
          />
          <path
            d="m19 7 8 9-8 9"
            fill="none"
            stroke="#52bcff"
            strokeWidth="3.5"
            strokeLinecap="square"
          />
        </svg>
      )}
      <span>
        Code <span className="text-accent">Duel</span>
      </span>
    </span>
  );
}
