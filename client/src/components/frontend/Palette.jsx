import { useState } from 'react';

/** The target's colors. Clicking a swatch copies its hex code. */
export default function Palette({ colors = [] }) {
  const [copied, setCopied] = useState(null);

  async function copy(color) {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(color);
      setTimeout(() => setCopied((c) => (c === color ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="eyebrow">Palette</h2>
      <ul className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <li key={color}>
            <button
              type="button"
              onClick={() => copy(color)}
              className="flex items-center gap-2 rounded-lg border border-line bg-canvas/50 py-1 pr-2.5 pl-1 font-mono text-xs text-zinc-300 transition hover:border-line-strong hover:text-ink"
              title={`Copy ${color}`}
              aria-label={`Copy color ${color}`}
            >
              <span
                className="size-5 rounded ring-1 ring-white/15 ring-inset"
                style={{ background: color }}
                aria-hidden="true"
              />
              {copied === color ? 'Copied!' : color}
            </button>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {copied ? `${copied} copied to the clipboard` : ''}
      </p>
    </div>
  );
}
