import { LANGUAGES } from '@/lib/verdicts.js';

export default function LanguageSelect({ value, onChange, disabled }) {
  return (
    <>
      <label className="sr-only" htmlFor="language">
        Language
      </label>
      <select
        id="language"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </>
  );
}
