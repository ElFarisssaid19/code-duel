import { useId } from 'react';
import Input from '@/components/ui/Input.jsx';

/** Labelled input with an optional hint and a per-field error message. */
export default function FormField({ label, error, hint, type = 'text', ...inputProps }) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        invalid={Boolean(error)}
        aria-describedby={error || hint ? messageId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={messageId} className="text-sm text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
