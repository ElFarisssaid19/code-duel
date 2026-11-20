import { useId } from 'react';
import Select from '@/components/ui/Select.jsx';
import { LANGUAGES } from '@/lib/verdicts.js';

const OPTIONS = LANGUAGES.map((l) => ({ value: l.id, label: l.label }));

export default function LanguageSelect({ value, onChange, disabled }) {
  const id = useId();
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Language
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        options={OPTIONS}
        className="w-36"
        data-testid="language-select"
      />
    </>
  );
}
