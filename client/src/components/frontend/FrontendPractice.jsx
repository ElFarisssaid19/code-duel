import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import FrontendWorkspace from '@/components/frontend/FrontendWorkspace.jsx';
import { submissionPayload } from '@/components/frontend/payload.js';
import Button from '@/components/ui/Button.jsx';
import Modal from '@/components/ui/Modal.jsx';
import { useRunShortcuts } from '@/hooks/useRunShortcuts.js';
import { api } from '@/lib/api.js';
import { loadItem, removeItem, saveItem } from '@/lib/storage.js';

const codeKey = (slug, part) => `code-duel:frontend:${slug}:${part}`;
const noop = () => {};

/** FRONTEND practice: edit HTML/CSS with a live preview, submit for the official score. */
export default function FrontendPractice({ problem }) {
  const { slug } = problem;
  const [html, setHtml] = useState(
    () => loadItem(codeKey(slug, 'html')) ?? problem.starterCode.html,
  );
  const [css, setCss] = useState(() => loadItem(codeKey(slug, 'css')) ?? problem.starterCode.css);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pane, setPane] = useState('target');
  const [confirmReset, setConfirmReset] = useState(false);
  const busy = useRef(false);

  const changeHtml = (next) => {
    setHtml(next);
    saveItem(codeKey(slug, 'html'), next); // autosave per problem
  };
  const changeCss = (next) => {
    setCss(next);
    saveItem(codeKey(slug, 'css'), next);
  };

  function reset() {
    setHtml(problem.starterCode.html);
    setCss(problem.starterCode.css);
    removeItem(codeKey(slug, 'html'));
    removeItem(codeKey(slug, 'css'));
    setConfirmReset(false);
  }

  const submit = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    setPane('preview');
    try {
      setResult(
        await api.post(`/practice/${slug}/submit`, submissionPayload(problem, { html, css })),
      );
    } catch (err) {
      setError(err);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [slug, problem, html, css]);
  useRunShortcuts(noop, submit);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3">
        <Link
          to="/problems?category=FRONTEND"
          className="rounded text-sm text-ink-muted hover:text-ink"
        >
          ← Problems
        </Link>
        <span className="hidden truncate text-sm font-medium text-zinc-200 sm:inline">
          {problem.title}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(true)} disabled={submitting}>
            Reset
          </Button>
          <Button onClick={submit} loading={submitting} title="Submit (Ctrl+Shift+Enter)">
            Submit
          </Button>
        </div>
      </header>

      <FrontendWorkspace
        problem={problem}
        pathPrefix={`practice-${slug}`}
        html={html}
        css={css}
        onHtml={changeHtml}
        onCss={changeCss}
        onSubmit={submit}
        submitting={submitting}
        result={result}
        error={error}
        pane={pane}
        onPane={setPane}
      />

      <Modal
        open={confirmReset}
        title="Reset your code?"
        onClose={() => setConfirmReset(false)}
        tone="danger"
      >
        <p className="text-sm text-zinc-300">
          Your HTML and CSS for this problem will be replaced by the starter code.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(false)} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={reset}>
            Reset code
          </Button>
        </div>
      </Modal>
    </div>
  );
}
