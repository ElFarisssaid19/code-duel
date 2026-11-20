import { useState } from 'react';
import FrontendEditor from '@/components/frontend/FrontendEditor.jsx';
import PreviewCompare from '@/components/frontend/PreviewCompare.jsx';
import ScoreResult from '@/components/frontend/ScoreResult.jsx';
import TargetPanel from '@/components/frontend/TargetPanel.jsx';
import Tabs from '@/components/ui/Tabs.jsx';

const PANES = [
  { id: 'target', label: 'Target' },
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
];

/**
 * FRONTEND layout shared by practice and the arena: Target | Editor | Preview + score.
 * Three columns from 1024 px; below that, one pane at a time with Target / Editor / Preview tabs.
 * `pane` / `onPane` are controlled so the parent can jump to the preview after a submit.
 */
export default function FrontendWorkspace({
  problem,
  pathPrefix,
  html,
  css,
  onHtml,
  onCss,
  onSubmit,
  submitting,
  result,
  error,
  toolbar,
  pane,
  onPane,
}) {
  const [localPane, setLocalPane] = useState('target');
  const current = pane ?? localPane;
  const setPane = onPane ?? setLocalPane;
  const hidden = (id) => (current === id ? '' : 'hidden');

  return (
    <>
      <Tabs
        className="lg:hidden"
        label="Frontend workspace"
        tabs={PANES}
        value={current}
        onChange={setPane}
        panelId={(tab) => `${pathPrefix}-${tab.id}`}
        renderTab={(tab) => (
          <>
            {tab.label}
            {tab.id === 'preview' && submitting && (
              <span className="ml-1.5 animate-pulse" aria-hidden="true">
                •
              </span>
            )}
          </>
        )}
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,4fr)_minmax(0,5fr)]">
        <section
          id={`${pathPrefix}-target`}
          className={`min-h-0 min-w-0 overflow-y-auto border-line lg:block lg:border-r ${hidden('target')}`}
          aria-label="Target"
        >
          <TargetPanel problem={problem} />
        </section>

        <section
          id={`${pathPrefix}-editor`}
          className={`flex min-h-0 min-w-0 flex-col border-line lg:flex lg:border-r ${current === 'editor' ? '' : 'hidden'}`}
          aria-label="Editor"
        >
          {toolbar}
          <div className="h-[60dvh] min-h-0 lg:h-auto lg:flex-1">
            <FrontendEditor
              problem={problem}
              pathPrefix={pathPrefix}
              html={html}
              css={css}
              onHtml={onHtml}
              onCss={onCss}
              onSubmit={onSubmit}
            />
          </div>
        </section>

        <section
          id={`${pathPrefix}-preview`}
          className={`min-h-0 min-w-0 space-y-5 overflow-y-auto p-4 lg:block lg:p-5 ${hidden('preview')}`}
          aria-label="Preview and score"
        >
          <div aria-live="polite">
            <ScoreResult
              result={result}
              error={error}
              submitting={submitting}
              threshold={problem.threshold}
            />
          </div>
          <PreviewCompare problem={problem} html={html} css={css} diffImage={result?.diffImage} />
        </section>
      </div>
    </>
  );
}
