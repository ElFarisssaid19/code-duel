import { useId, useRef } from 'react';

const VARIANTS = {
  underline: {
    list: 'flex border-b border-line',
    tab: (selected) =>
      `flex-1 border-b-2 px-3 py-2.5 text-sm font-medium transition hover:text-ink focus-visible:-outline-offset-2 ${
        selected ? 'border-accent text-ink' : 'border-transparent text-ink-muted'
      }`,
  },
  pill: {
    list: 'inline-flex rounded-lg border border-line bg-canvas/40 p-0.5',
    tab: (selected) =>
      `rounded-md px-3 py-1.5 text-sm transition ${selected ? 'bg-surface-raised text-ink' : 'text-ink-muted hover:text-ink'}`,
  },
  chips: {
    list: 'flex gap-1 overflow-x-auto pb-1',
    tab: (selected) =>
      `relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
        selected
          ? 'bg-surface-raised text-ink'
          : 'text-ink-muted hover:bg-surface-raised/60 hover:text-ink'
      }`,
  },
};

/**
 * Accessible tabs (WAI-ARIA tabs pattern): one tab stop (roving tabindex), Left/Right arrows
 * move between tabs, Home/End jump to the first/last. `tabs`: [{ id, label }].
 * Pass `panelId(tab)` when the tabs control panels (adds aria-controls).
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  label,
  variant = 'underline',
  className = '',
  renderTab,
  panelId,
}) {
  const baseId = useId();
  const refs = useRef([]);
  const styles = VARIANTS[variant];

  function onKeyDown(event, index) {
    const last = tabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  }

  return (
    <div role="tablist" aria-label={label} className={`${styles.list} ${className}`}>
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => (refs.current[i] = el)}
            id={`${baseId}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId?.(tab)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={styles.tab(selected)}
          >
            {renderTab ? renderTab(tab, selected) : tab.label}
          </button>
        );
      })}
    </div>
  );
}
