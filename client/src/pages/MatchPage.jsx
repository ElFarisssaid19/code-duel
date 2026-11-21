import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import Button from '@/components/ui/Button.jsx';
import FullPageSpinner from '@/components/FullPageSpinner.jsx';
import Logo from '@/components/Logo.jsx';
import MuteToggle from '@/components/MuteToggle.jsx';
import ConnectionBanner from '@/components/layout/ConnectionBanner.jsx';
import Confetti from '@/components/match/Confetti.jsx';
import Countdown from '@/components/match/Countdown.jsx';
import FrontendWorkspace from '@/components/frontend/FrontendWorkspace.jsx';
import { submissionPayload } from '@/components/frontend/payload.js';
import MatchTimer from '@/components/match/MatchTimer.jsx';
import PlayerProgress from '@/components/match/PlayerProgress.jsx';
import ResultModal from '@/components/match/ResultModal.jsx';
import ShareModal from '@/components/match/ShareModal.jsx';
import { opponentLabelStart, outcomeOf } from '@/components/match/format.js';
import CodeEditor from '@/components/practice/CodeEditor.jsx';
import LanguageSelect from '@/components/practice/LanguageSelect.jsx';
import LinesChanged from '@/components/practice/LinesChanged.jsx';
import ProblemStatement from '@/components/practice/ProblemStatement.jsx';
import ResultsPanel from '@/components/practice/ResultsPanel.jsx';
import { paramNames } from '@/components/practice/params.js';
import Modal from '@/components/ui/Modal.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { ToastStack } from '@/components/ui/Toast.jsx';
import { useNow } from '@/hooks/useNow.js';
import { useReducedMotion } from '@/hooks/useReducedMotion.js';
import { useRunShortcuts } from '@/hooks/useRunShortcuts.js';
import { useToasts } from '@/hooks/useToasts.js';
import { CATEGORY_LABELS, formatScore, TRACK_LABELS } from '@/lib/categories.js';
import { playSound } from '@/lib/sound.js';
import { request, socket } from '@/lib/socket.js';
import { loadItem, saveItem } from '@/lib/storage.js';
import { useAuthStore } from '@/store/authStore.js';

const FILE_EXTENSIONS = { javascript: 'js', python: 'py' };
const ACTIVITY_PING_MS = 1500;
const TYPING_VISIBLE_MS = 2500;
const PANES = [
  { id: 'problem', label: 'Problem' },
  { id: 'editor', label: 'Editor' },
  { id: 'results', label: 'Results' },
];
const codeKey = (matchId, language) => `code-duel:match:${matchId}:code:${language}`;
const languageKey = (matchId) => `code-duel:match:${matchId}:language`;

/** Client copy of the match state; every change comes from the server (snapshot or event). */
function reducer(state, action) {
  // Events can arrive before the first snapshot (e.g. match:countdown triggered by the other
  // player joining): ignore them, the snapshot already reflects them.
  if (state === null && action.type !== 'snapshot') return state;
  switch (action.type) {
    case 'snapshot':
      return action.snapshot;
    case 'countdown':
      return { ...state, status: 'COUNTDOWN', startsAt: action.startsAt };
    case 'start':
      return {
        ...state,
        status: 'ACTIVE',
        problem: action.problem,
        endsAt: action.endsAt,
        me: { ...state.me, ...action.me },
        opponent: { ...state.opponent, ...action.opponent },
      };
    case 'myProgress':
      return { ...state, me: { ...state.me, ...action.progress } };
    case 'opponentProgress':
      return { ...state, opponent: { ...state.opponent, ...action.progress } };
    case 'opponentConnection':
      return { ...state, opponent: { ...state.opponent, connected: action.connected } };
    case 'end':
      return {
        ...state,
        status: action.result.reason === 'CANCELLED' ? 'CANCELLED' : 'FINISHED',
        result: action.result,
      };
    case 'rematch':
      return { ...state, rematch: action.rematch };
    default:
      return state;
  }
}

/** Focus-mode header: logo, mode, timer and both players' progress (tests or best score). */
function ArenaHeader({ state, offsetMs, typingUntil }) {
  const { me, opponent } = state;
  const live = state.status === 'ACTIVE';
  const now = useNow(250);
  const modeLabel = { RANKED: 'Ranked duel', PRIVATE: 'Private duel', GHOST: 'Ghost duel' }[
    state.mode
  ];
  return (
    <header className="border-b border-line bg-canvas/90 px-4 pt-2 pb-3">
      {/* Focus mode: no navbar, just a minimal header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <Logo className="text-sm" />
        <div className="flex items-center gap-1">
          <span className="eyebrow">
            {state.category === 'FRONTEND'
              ? `${modeLabel} · Frontend${state.problem?.track ? ` · ${TRACK_LABELS[state.problem.track]}` : ''}`
              : state.category === 'DEBUG'
                ? `${modeLabel} · ${CATEGORY_LABELS.DEBUG}`
                : modeLabel}
          </span>
          <MuteToggle />
        </div>
      </div>
      <div className="grid grid-cols-2 items-center gap-x-4 gap-y-2 lg:flex lg:gap-4">
        <div className="col-span-2 flex justify-center lg:order-2 lg:col-span-1 lg:shrink-0 lg:px-2">
          <MatchTimer endsAt={state.endsAt} now={now} offsetMs={offsetMs} stopped={!live} />
        </div>
        <PlayerProgress player={me} label="you" className="lg:order-1" />
        <PlayerProgress
          player={opponent}
          align="right"
          accent="sky"
          typing={live && now < typingUntil}
          className="lg:order-3"
        />
      </div>
    </header>
  );
}

const frontendKey = (matchId, part) => `code-duel:match:${matchId}:frontend:${part}`;
const noop = () => {};

/** FRONTEND arena: Target | Editor | Preview (tabs below 1024 px). Submit = official score. */
function FrontendArena({ state, matchId, offsetMs, typingUntil, onForfeit }) {
  const { problem } = state;
  const live = state.status === 'ACTIVE';
  const [html, setHtml] = useState(
    () => loadItem(frontendKey(matchId, 'html')) ?? problem.starterCode.html,
  );
  const [css, setCss] = useState(
    () => loadItem(frontendKey(matchId, 'css')) ?? problem.starterCode.css,
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pane, setPane] = useState('target');
  const busy = useRef(false);
  const lastPing = useRef(0);

  function ping() {
    if (live && Date.now() - lastPing.current > ACTIVITY_PING_MS) {
      lastPing.current = Date.now();
      socket.emit('match:activity');
    }
  }
  const changeHtml = (next) => {
    setHtml(next);
    saveItem(frontendKey(matchId, 'html'), next); // restored after a refresh
    ping();
  };
  const changeCss = (next) => {
    setCss(next);
    saveItem(frontendKey(matchId, 'css'), next);
    ping();
  };

  const submit = useCallback(async () => {
    if (busy.current || !live) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    setPane('preview');
    try {
      const data = await request('match:submit', submissionPayload(problem, { html, css }));
      setResult(data.result);
    } catch (err) {
      setError(err);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [problem, html, css, live]);
  useRunShortcuts(noop, submit);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <ConnectionBanner />
      <ArenaHeader state={state} offsetMs={offsetMs} typingUntil={typingUntil} />
      <FrontendWorkspace
        problem={problem}
        pathPrefix={`match-${matchId}`}
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
        toolbar={
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="text-xs text-ink-subtle">
              Solved at <span className="font-mono text-ink">{formatScore(problem.threshold)}</span>
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="danger-outline" onClick={onForfeit} disabled={!live}>
                Forfeit
              </Button>
              <Button
                onClick={submit}
                loading={submitting}
                disabled={submitting || !live}
                title="Submit (Ctrl+Shift+Enter)"
              >
                Submit
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

function Arena({ state, matchId, offsetMs, typingUntil, onForfeit }) {
  const { problem } = state;
  const live = state.status === 'ACTIVE';

  const preferredLanguage = useAuthStore((s) => s.user?.preferredLanguage);
  const [language, setLanguage] = useState(() => {
    const saved = loadItem(languageKey(matchId));
    if (saved in FILE_EXTENSIONS) return saved;
    return preferredLanguage in FILE_EXTENSIONS ? preferredLanguage : 'javascript';
  });
  const [code, setCode] = useState(
    () => loadItem(codeKey(matchId, language)) ?? problem.starterCode[language],
  );
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const [resultLines, setResultLines] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [pane, setPane] = useState('problem'); // small screens only: one pane at a time
  const debug = problem.category === 'DEBUG';
  const runningRef = useRef(false);
  const lastPing = useRef(0);

  function changeCode(next) {
    setCode(next);
    saveItem(codeKey(matchId, language), next); // restored after a refresh
    if (live && Date.now() - lastPing.current > ACTIVITY_PING_MS) {
      lastPing.current = Date.now();
      socket.emit('match:activity');
    }
  }

  function changeLanguage(next) {
    setLanguage(next);
    setCode(loadItem(codeKey(matchId, next)) ?? problem.starterCode[next]);
    saveItem(languageKey(matchId), next);
  }

  const execute = useCallback(
    async (mode) => {
      if (runningRef.current || !live) return;
      runningRef.current = true;
      setRunning(mode);
      setError(null);
      setPane('results');
      try {
        const data = await request(mode === 'run' ? 'match:run' : 'match:submit', {
          language,
          code,
        });
        setResult(data.result);
        setResultLines(data.linesChanged ?? null);
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
    [language, code, live],
  );
  const run = useCallback(() => execute('run'), [execute]);
  const submit = useCallback(() => execute('submit'), [execute]);
  useRunShortcuts(run, submit);

  const params = paramNames(problem.starterCode[language]);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <ConnectionBanner />
      <ArenaHeader state={state} offsetMs={offsetMs} typingUntil={typingUntil} />

      <Tabs
        className="lg:hidden"
        label="Arena"
        tabs={PANES}
        value={pane}
        onChange={setPane}
        panelId={(tab) => `arena-${tab.id}`}
        renderTab={(tab) => (
          <>
            {tab.label}
            {tab.id === 'results' && running && (
              <span className="ml-1.5 animate-pulse" aria-hidden="true">
                •
              </span>
            )}
          </>
        )}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          id="arena-problem"
          className={`min-h-0 min-w-0 overflow-y-auto border-line lg:block lg:border-r ${pane === 'problem' ? '' : 'hidden'}`}
          aria-label="Problem"
        >
          <ProblemStatement problem={problem} params={params} />
        </section>

        <section
          className={`min-h-0 min-w-0 flex-col lg:flex ${pane === 'problem' ? 'hidden' : 'flex'}`}
          aria-label="Editor and results"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <LanguageSelect
              value={language}
              onChange={changeLanguage}
              disabled={Boolean(running)}
            />
            {debug && <LinesChanged original={problem.starterCode[language]} code={code} />}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="danger-outline" onClick={onForfeit} disabled={!live}>
                Forfeit
              </Button>
              <Button
                variant="secondary"
                onClick={run}
                loading={running === 'run'}
                disabled={Boolean(running) || !live}
                title="Run sample tests (Ctrl+Enter)"
              >
                Run
              </Button>
              <Button
                onClick={submit}
                loading={running === 'submit'}
                disabled={Boolean(running) || !live}
                title="Submit (Ctrl+Shift+Enter)"
              >
                Submit
              </Button>
            </div>
          </div>
          <div
            id="arena-editor"
            className={`h-[60dvh] min-h-0 border-b border-line lg:block lg:h-auto lg:flex-[3] ${pane === 'editor' ? '' : 'hidden'}`}
          >
            <CodeEditor
              path={`match-${matchId}/solution.${FILE_EXTENSIONS[language]}`}
              language={language}
              value={code}
              onChange={changeCode}
              onRun={run}
              onSubmit={submit}
            />
          </div>
          <div
            id="arena-results"
            className={`min-h-[220px] overflow-y-auto p-4 lg:block lg:flex-[2] ${pane === 'results' ? '' : 'hidden'}`}
            aria-live="polite"
          >
            <ResultsPanel
              result={result}
              running={running}
              error={error}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              params={params}
              linesChanged={resultLines}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function MatchSession({ matchId }) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, null);
  const [loadError, setLoadError] = useState(null);
  const [offsetMs, setOffsetMs] = useState(0); // server clock − client clock
  const [typingUntil, setTypingUntil] = useState(0);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState(null);
  const [toasts, toast] = useToasts();
  const [celebrate, setCelebrate] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ghostBusy, setGhostBusy] = useState(false);
  const opponentRef = useRef(null); // for honest toasts ("The ghost of @x now passes…")
  const reducedMotion = useReducedMotion();
  const opponentPassed = useRef(0);
  const now = useNow(200);

  useEffect(() => {
    let cancelled = false;
    const syncClock = (serverNow) => serverNow && setOffsetMs(serverNow - Date.now());

    // (Re)join on mount and after every reconnect: restores timer, progress and result.
    async function rejoin() {
      try {
        const snapshot = await request('match:rejoin', { matchId });
        if (cancelled) return;
        syncClock(snapshot.serverNow);
        opponentPassed.current = snapshot.opponent.score ?? snapshot.opponent.passed;
        opponentRef.current = snapshot.opponent;
        dispatch({ type: 'snapshot', snapshot });
      } catch (err) {
        if (!cancelled) setLoadError(err);
      }
    }

    const handlers = {
      connect: rejoin,
      'match:countdown': (p) => {
        syncClock(p.serverNow);
        dispatch({ type: 'countdown', startsAt: p.startsAt });
      },
      'match:start': (p) => {
        playSound('go');
        syncClock(p.serverNow);
        dispatch({ type: 'start', ...p });
      },
      'match:submit:result': (p) => dispatch({ type: 'myProgress', progress: p.progress }),
      'opponent:progress': (progress) => {
        // FRONTEND progress is the best score; ALGO progress is the number of tests passed.
        const value = progress.score ?? progress.passed;
        if (value > opponentPassed.current) {
          playSound('opponentProgress');
          const who = opponentRef.current?.ghost
            ? opponentLabelStart(opponentRef.current)
            : 'Your opponent';
          toast(
            progress.score !== undefined
              ? `${who} now scores ${formatScore(progress.score)}`
              : `${who} now passes ${progress.passed}/${progress.total} tests`,
            'info',
          );
        }
        opponentPassed.current = Math.max(opponentPassed.current, value);
        dispatch({ type: 'opponentProgress', progress });
      },
      'opponent:activity': () => setTypingUntil(Date.now() + TYPING_VISIBLE_MS),
      'opponent:connection': ({ connected }) => {
        dispatch({ type: 'opponentConnection', connected });
        toast(
          connected
            ? 'Your opponent reconnected'
            : 'Your opponent disconnected (30 s to come back)',
          connected ? 'default' : 'warning',
        );
      },
      'match:end': (result) => {
        if (result.matchId !== matchId) return;
        dispatch({ type: 'end', result });
        const outcome = outcomeOf(result, useAuthStore.getState().user?.id);
        if (outcome !== 'cancelled') playSound(outcome === 'loss' ? 'lose' : outcome);
        if (outcome === 'win') setCelebrate(true);
        useAuthStore.getState().fetchMe(); // new ELO for the navbar badge
      },
      'rematch:update': (rematch) =>
        rematch.matchId === matchId && dispatch({ type: 'rematch', rematch }),
    };
    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    if (socket.connected) rejoin();
    return () => {
      cancelled = true;
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
    };
  }, [matchId, toast]);

  async function forfeit() {
    setForfeiting(true);
    try {
      await request('match:forfeit');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      setForfeiting(false);
      setConfirmForfeit(false);
    }
  }

  /** "Play another ghost": same category (and track); match:found navigates to the new match. */
  async function anotherGhost() {
    setGhostBusy(true);
    try {
      await request(
        'ghost:start',
        state.category && state.category !== 'ALGO'
          ? {
              category: state.category,
              ...(state.category === 'FRONTEND' && state.track && { track: state.track }),
            }
          : {},
      );
    } catch (err) {
      toast(err.message, 'danger');
      setGhostBusy(false);
    }
  }

  async function rematch() {
    setRematchBusy(true);
    setRematchError(null);
    try {
      const offer = await request('rematch:request', { matchId });
      dispatch({ type: 'rematch', rematch: offer }); // accepted → match:found navigates
    } catch (err) {
      setRematchError(err.message);
    } finally {
      setRematchBusy(false);
    }
  }

  if (loadError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-display text-lg font-semibold">{loadError.message}</p>
        <Link to="/" className="rounded text-sm text-accent hover:text-emerald-300">
          ← Back home
        </Link>
      </main>
    );
  }
  if (!state) return <FullPageSpinner />;

  const ended = state.status === 'FINISHED' || state.status === 'CANCELLED';
  return (
    <>
      {state.problem?.category === 'FRONTEND' ? (
        <FrontendArena
          state={state}
          matchId={matchId}
          offsetMs={offsetMs}
          typingUntil={typingUntil}
          onForfeit={() => setConfirmForfeit(true)}
        />
      ) : state.problem ? (
        <Arena
          state={state}
          matchId={matchId}
          offsetMs={offsetMs}
          typingUntil={typingUntil}
          onForfeit={() => setConfirmForfeit(true)}
        />
      ) : (
        !ended && <Countdown state={state} now={now} offsetMs={offsetMs} />
      )}

      <Modal
        open={confirmForfeit && !ended}
        title="Forfeit the match?"
        onClose={() => setConfirmForfeit(false)}
        tone="danger"
      >
        <p className="text-sm text-zinc-300">
          {state.opponent.username} wins immediately
          {state.mode === 'RANKED' ? ' and you lose ELO' : ''}.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmForfeit(false)} data-autofocus>
            Keep playing
          </Button>
          <Button variant="danger" onClick={forfeit} loading={forfeiting}>
            Forfeit
          </Button>
        </div>
      </Modal>

      {ended && state.result && !sharing && (
        <ResultModal
          result={state.result}
          meId={state.me.userId}
          opponent={state.opponent}
          opponentName={state.opponent.username}
          onAnotherGhost={state.result.mode === 'GHOST' ? anotherGhost : null}
          ghostBusy={ghostBusy}
          onShare={state.status === 'FINISHED' ? () => setSharing(true) : null}
          rematch={
            state.rematch ??
            (state.result.mode === 'PRIVATE' ? { status: 'open', requestedBy: [] } : null)
          }
          onRematch={rematch}
          rematchBusy={rematchBusy}
          rematchError={rematchError}
          onHome={() => navigate('/')}
        />
      )}
      {sharing && <ShareModal open matchId={matchId} onClose={() => setSharing(false)} />}
      {celebrate && !reducedMotion && <Confetti />}
      <ToastStack toasts={toasts} />
    </>
  );
}

export default function MatchPage() {
  const { id } = useParams();
  return <MatchSession key={id} matchId={Number(id)} />;
}
