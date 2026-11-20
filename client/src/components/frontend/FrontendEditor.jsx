import { useState } from 'react';
import CodeEditor from '@/components/practice/CodeEditor.jsx';
import Tabs from '@/components/ui/Tabs.jsx';

/** Editor tabs for a track. The CSS track shows the fixed HTML read-only; HTML has no CSS tab. */
function editorTabs(track) {
  if (track === 'CSS') {
    return [
      { id: 'css', label: 'CSS' },
      { id: 'html', label: 'HTML', readOnly: true },
    ];
  }
  if (track === 'HTML') return [{ id: 'html', label: 'HTML' }];
  return [
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
  ];
}

/** HTML / CSS editors (one Monaco instance, one model per tab). Ctrl+Shift+Enter submits. */
export default function FrontendEditor({
  problem,
  pathPrefix,
  html,
  css,
  onHtml,
  onCss,
  onSubmit,
}) {
  const tabs = editorTabs(problem.track);
  const [active, setActive] = useState(tabs[0].id);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  const isHtml = tab.id === 'html';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        variant="underline"
        label="Code"
        tabs={tabs}
        value={tab.id}
        onChange={setActive}
        panelId={() => `${pathPrefix}-editor-panel`}
        renderTab={(t) => (
          <>
            {t.label}
            {t.readOnly && <span className="ml-1.5 text-xs text-ink-subtle">(read-only)</span>}
          </>
        )}
      />
      <div id={`${pathPrefix}-editor-panel`} className="min-h-0 flex-1" role="tabpanel">
        <CodeEditor
          key={tab.id}
          path={`${pathPrefix}/index.${tab.id}`}
          language={tab.id}
          label={`${tab.label} editor`}
          value={tab.readOnly ? (problem.fixedHtml ?? '') : isHtml ? html : css}
          onChange={tab.readOnly ? () => {} : isHtml ? onHtml : onCss}
          onSubmit={onSubmit}
          readOnly={Boolean(tab.readOnly)}
        />
      </div>
    </div>
  );
}
