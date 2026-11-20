import { fieldClasses } from '@/components/ui/styles.js';

/** Native <select> (best keyboard + screen reader support) with the shared field style. */
export default function Select({ options, className = '', invalid = false, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select className={fieldClasses(invalid, 'appearance-none py-2 pr-9 text-sm')} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle"
      >
        <path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
      </svg>
    </div>
  );
}
