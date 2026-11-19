import { useId } from 'react';

/** Labelled input with an optional hint and a per-field error message. */
export default function FormField({ label, error, hint, type = 'text', ...inputProps }) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={`block w-full rounded-lg border bg-zinc-950/60 px-3.5 py-2.5 text-zinc-100 transition outline-none placeholder:text-zinc-600 focus:ring-2 ${
          error
            ? 'border-red-500/70 focus:ring-red-500/30'
            : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/25'
        }`}
        {...inputProps}
      />
      {error ? (
        <p id={messageId} className="text-sm text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
