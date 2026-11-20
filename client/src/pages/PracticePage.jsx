import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Button from '@/components/ui/Button.jsx';
import ErrorState from '@/components/ui/ErrorState.jsx';
import Modal from '@/components/ui/Modal.jsx';
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton.jsx';
import CodeEditor from '@/components/practice/CodeEditor.jsx';
import LanguageSelect from '@/components/practice/LanguageSelect.jsx';
import ProblemStatement from '@/components/practice/ProblemStatement.jsx';
import ResultsPanel from '@/components/practice/ResultsPanel.jsx';
import { paramNames } from '@/components/practice/params.js';
import { useApi } from '@/hooks/useApi.js';
import { useRunShortcuts } from '@/hooks/useRunShortcuts.js';
import { api } from '@/lib/api.js';
import { loadItem, removeItem, saveItem } from '@/lib/storage.js';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import { useAuthStore } from '@/store/authStore.js';

const codeKey = (slug, language) => `code-duel:code:${slug}:${language}`;
const languageKey = (slug) => `code-duel:practice:${slug}:language`;
const FILE_EXTENSIONS = { javascript: 'js', python: 'py' };

/** The language last used on this problem, otherwise the account's default (Settings). */
function initialLanguage(slug, preferred) {
  const saved = loadItem(languageKey(slug));
  if (saved in FILE_EXTENSIONS) return saved;
  return preferred in FILE_EXTENSIONS ? preferred : 'javascript';
}

function Workspace({ problem }) {
  const { slug } = problem;
  const preferredLanguage = useAuthStore((s) => s.user?.preferredLanguage);
  const [language, setLanguage] = useState(() => initialLanguage(slug, preferredLanguage));
  const [confirmReset, setConfirmReset] = useState(false);
  const [code, setCode] = useState(
    () => loadItem(codeKey(slug, language)) ?? problem.starterCode[language],
  );
  const [running, setRunning] = useState(null); // null | 'run' | 'submit'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const runningRef = useRef(false);

  const params = paramNames(problem.starterCode[language]);

  function changeCode(next) {
    setCode(next);
    saveItem(codeKey(slug, language), next); // autosave per problem + language
  }

  function changeLanguage(next) {
    setLanguage(next);
    setCode(loadItem(codeKey(slug, next)) ?? problem.starterCode[next]);
    saveItem(languageKey(slug), next);
  }

  function resetCode() {
    setCode(problem.starterCode[language]);
    removeItem(codeKey(slug, language));
    setConfirmReset(false);
  }

  const execute = useCallback(
    async (mode) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(mode);
      setError(null);
      try {
        const data = await api.post(`/practice/${slug}/${mode}`, { language, code });
        setResult(data.result);
        // Open the first failing test (or the first one).
        setActiveTab(
          Math.max(
            0,
            data.result.tests.findIndex((t) => t.status !== 'ACCEPTED'),
          ),
        );
      } catch (err) {
        setError(err);
      } finally {
        runningRef.current = false;
        setRunning(null);
      }
    },
    [slug, language, code],
  );
  const run = useCallback(() => execute('run'), [execute]);
  const submit = useCallback(() => execute('submit'), [execute]);

  useRunShortcuts(run, submit);

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3">
        <Link to="/problems" className="rounded text-sm text-ink-muted hover:text-ink">
          ← Problems
        </Link>
        <span className="hidden truncate text-sm font-medium text-zinc-200 sm:inline">
          {problem.title}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LanguageSelect value={language} onChange={changeLanguage} disabled={Boolean(running)} />
          <Button
            variant="secondary"
            onClick={() => setConfirmReset(true)}
            disabled={Boolean(running)}
            title="Reset to starter code"
          >
            Reset
          </Button>
          <Button
            variant="secondary"
            onClick={run}
            loading={running === 'run'}
            disabled={Boolean(running)}
            title="Run sample tests (Ctrl+Enter)"
          >
            Run
          </Button>
          <Button
            onClick={submit}
            loading={running === 'submit'}
            disabled={Boolean(running)}
            title="Submit (Ctrl+Shift+Enter)"
          >
            Submit
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          className="min-h-0 min-w-0 overflow-y-auto border-zinc-800 lg:border-r"
          aria-label="Problem"
        >
          <ProblemStatement problem={problem} params={params} />
        </section>

        <section className="flex min-h-0 min-w-0 flex-col" aria-label="Editor and results">
          <div className="h-[420px] min-h-0 border-b border-zinc-800 lg:h-auto lg:flex-[3]">
            <CodeEditor
              path={`${slug}/solution.${FILE_EXTENSIONS[language]}`}
              language={language}
              value={code}
              onChange={changeCode}
              onRun={run}
              onSubmit={submit}
            />
          </div>
          <div className="min-h-[220px] overflow-y-auto p-4 lg:flex-[2]" aria-live="polite">
            <ResultsPanel
              result={result}
              running={running}
              error={error}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              params={params}
            />
          </div>
        </section>
      </div>

      <Modal
        open={confirmReset}
        title="Reset your code?"
        onClose={() => setConfirmReset(false)}
        tone="danger"
      >
        <p className="text-sm text-zinc-300">
          Your current {language === 'python' ? 'Python' : 'JavaScript'} code for this problem will
          be replaced by the starter code.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReset(false)} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={resetCode}>
            Reset code
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PracticeSkeleton() {
  return (
    <SkeletonGroup
      label="Loading problem"
      className="grid flex-1 gap-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="space-y-4 p-5 lg:p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
      <Skeleton className="m-4 min-h-96 rounded-xl" />
    </SkeletonGroup>
  );
}

export default function PracticePage() {
  const { slug } = useParams();
  const { data, error, loading, retry } = useApi(`/problems/${slug}`);

  if (error?.status === 404)
    return (
      <NotFoundPage title="Problem not found" message={`There is no problem called "${slug}".`} />
    );
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <ErrorState message={error.message} onRetry={retry} />
        <p className="mt-4 text-center">
          <Link to="/problems" className="rounded text-sm text-accent hover:text-emerald-300">
            ← Back to problems
          </Link>
        </p>
      </main>
    );
  }
  if (loading) return <PracticeSkeleton />;
  return <Workspace key={slug} problem={data.problem} />;
}
