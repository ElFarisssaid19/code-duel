import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Button from '@/components/Button.jsx';
import DifficultyBadge from '@/components/DifficultyBadge.jsx';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import CodeEditor from '@/components/practice/CodeEditor.jsx';
import ResultsPanel from '@/components/practice/ResultsPanel.jsx';
import TestInput from '@/components/practice/TestInput.jsx';
import ValueBlock from '@/components/practice/ValueBlock.jsx';
import { formatValue, paramNames } from '@/components/practice/params.js';
import { api } from '@/lib/api.js';
import { renderMarkdown } from '@/lib/markdown.js';
import { loadItem, removeItem, saveItem } from '@/lib/storage.js';
import { LANGUAGES } from '@/lib/verdicts.js';

const LANGUAGE_KEY = 'code-duel:language';
const codeKey = (slug, language) => `code-duel:code:${slug}:${language}`;
const FILE_EXTENSIONS = { javascript: 'js', python: 'py' };

function initialLanguage() {
  const saved = loadItem(LANGUAGE_KEY);
  return LANGUAGES.some((l) => l.id === saved) ? saved : 'javascript';
}

function ProblemStatement({ problem, params }) {
  return (
    <div className="space-y-6 p-5 lg:p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">{problem.title}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <DifficultyBadge difficulty={problem.difficulty} />
          <span>Time limit: {problem.timeLimitMs} ms per test</span>
        </div>
      </div>

      {/* Sanitized with DOMPurify in renderMarkdown */}
      <div
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.description) }}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Sample tests</h2>
        {problem.samples.map((sample) => (
          <div
            key={sample.index}
            className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
          >
            <p className="text-xs font-medium text-zinc-400">Case {sample.index + 1}</p>
            <TestInput input={sample.input} params={params} />
            <ValueBlock label="Expected">{formatValue(sample.expected)}</ValueBlock>
          </div>
        ))}
      </section>
    </div>
  );
}

function Workspace({ problem }) {
  const { slug } = problem;
  const [language, setLanguage] = useState(initialLanguage);
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
    saveItem(LANGUAGE_KEY, next);
  }

  function resetCode() {
    if (
      !window.confirm(
        'Reset to the starter code? Your current code for this language will be lost.',
      )
    )
      return;
    setCode(problem.starterCode[language]);
    removeItem(codeKey(slug, language));
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

  // Shortcuts when the focus is outside the editor (the editor registers its own).
  useEffect(() => {
    function onKeyDown(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      if (event.target.closest?.('.monaco-editor')) return;
      event.preventDefault();
      if (event.shiftKey) submit();
      else run();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [run, submit]);

  return (
    <div className="flex flex-col lg:h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
        <Link to="/problems" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Problems
        </Link>
        <span className="hidden truncate text-sm font-medium text-zinc-200 sm:inline">
          {problem.title}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="language">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => changeLanguage(e.target.value)}
            disabled={Boolean(running)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={resetCode}
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
          className="min-h-0 overflow-y-auto border-zinc-800 lg:border-r"
          aria-label="Problem"
        >
          <ProblemStatement problem={problem} params={params} />
        </section>

        <section className="flex min-h-0 flex-col" aria-label="Editor and results">
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
    </div>
  );
}

export default function PracticePage() {
  const { slug } = useParams();
  const [state, setState] = useState({ slug: null, problem: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/problems/${slug}`)
      .then((data) => !cancelled && setState({ slug, problem: data.problem, error: null }))
      .catch((error) => !cancelled && setState({ slug, problem: null, error }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.slug !== slug) return <FullPageSpinner />;
  if (state.error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold">
          {state.error.status === 404 ? 'Problem not found' : state.error.message}
        </p>
        <Link to="/problems" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Back to problems
        </Link>
      </main>
    );
  }
  return <Workspace key={slug} problem={state.problem} />;
}
