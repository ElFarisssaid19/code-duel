import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import FormError from '@/components/FormError.jsx';
import { formatClock } from '@/components/match/format.js';
import Button from '@/components/ui/Button.jsx';
import Card from '@/components/ui/Card.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Tabs from '@/components/ui/Tabs.jsx';
import { CATEGORIES, CATEGORY_LABELS, isCategory, TRACK_LABELS, TRACKS } from '@/lib/categories.js';
import { request } from '@/lib/socket.js';
import { loadItem, saveItem } from '@/lib/storage.js';
import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';
import { usePlayStore } from '@/store/playStore.js';

const ROOM_DIFFICULTIES = [
  { value: 'ANY', label: 'Any difficulty' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

/**
 * One-time notice for accounts created before ghost replays existed. Dismissing it (or opening
 * Settings from it) is stored on the account, so it doesn't come back on other devices.
 */
function GhostNoticeBanner() {
  const dismissGhostNotice = useAuthStore((s) => s.dismissGhostNotice);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function dismiss(thenSettings) {
    setBusy(true);
    setError(null);
    try {
      await dismissGhostNotice();
      if (thenSettings) navigate('/settings');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-3 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 motion-safe:animate-fade-up"
      aria-label="Ghost replays"
      data-testid="ghost-notice"
    >
      <p className="text-sm text-sky-100">
        <span aria-hidden="true">👻 </span>
        Your ranked runs may be replayed as ghosts for other players (your username and progress,
        never your code). You can turn this off anytime in Settings.
      </p>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => dismiss(false)} disabled={busy}>
          Got it
        </Button>
        <Button size="sm" variant="secondary" onClick={() => dismiss(true)} loading={busy}>
          Settings
        </Button>
      </div>
    </section>
  );
}

const TRACK_OPTIONS = [
  { value: '', label: 'Any track' },
  ...TRACKS.map((t) => ({ value: t.id, label: t.label })),
];
const CHOICE_KEY = 'code-duel:play-choice';

/** "Frontend · CSS", "Algorithms"… */
const choiceLabel = ({ category, track }) =>
  category === 'FRONTEND' && track
    ? `${CATEGORY_LABELS.FRONTEND} · ${TRACK_LABELS[track]}`
    : CATEGORY_LABELS[category ?? 'ALGO'];

/** What to play: ALGO or FRONTEND (+ an optional track). Used by the ranked queue and new rooms. */
function CategoryPanel({ choice, onChange, disabled }) {
  const trackId = useId();
  return (
    <Panel title="Category">
      <Tabs
        variant="pill"
        label="Category"
        tabs={CATEGORIES}
        value={choice.category}
        onChange={(category) => !disabled && onChange({ category, track: null })}
      />
      <p className="text-sm text-ink-muted">
        {
          {
            FRONTEND:
              'Reproduce a target design with HTML/CSS. The first to reach the score threshold wins.',
            DEBUG:
              'Fix the bugs in code you are given (JavaScript or Python). The first to pass every test wins; fewer lines changed breaks ties.',
            ALGO: 'Solve an algorithm problem in JavaScript or Python. The first to pass every test wins.',
          }[choice.category]
        }
      </p>
      {choice.category === 'FRONTEND' && (
        <div className="flex items-center gap-3">
          <label htmlFor={trackId} className="text-sm text-ink-muted">
            Track
          </label>
          <Select
            id={trackId}
            data-testid="track-select"
            value={choice.track ?? ''}
            onChange={(e) => onChange({ ...choice, track: e.target.value || null })}
            options={TRACK_OPTIONS}
            disabled={disabled}
            className="min-w-0 flex-1"
          />
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, className = 'text-ink' }) {
  return (
    <div className="rounded-xl border border-line bg-canvas/50 px-4 py-3 text-center">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-semibold ${className}`}>{value}</dd>
    </div>
  );
}

function Panel({ title, children, glow }) {
  return (
    <Card as="section" className="space-y-4" padding="p-5" glow={glow}>
      <h2 className="eyebrow">{title}</h2>
      {children}
    </Card>
  );
}

function RankedPanel({ queue, busy, disabled, onPlay, onCancel, onGhost, ghostBusy, choice }) {
  if (queue) {
    return (
      <Panel title="Ranked" glow="accent">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium text-ink">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
              </span>
              Searching for an opponent…
            </p>
            <p className="mt-1 text-xs text-ink-subtle">{choiceLabel(queue)}</p>
            <p className="mt-1 font-mono text-sm text-ink-muted" aria-live="polite">
              {formatClock(queue.elapsedMs ?? 0)} ·{' '}
              {queue.window ? `±${queue.window} ELO` : 'any ELO'}
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel} loading={busy}>
            Cancel
          </Button>
        </div>
        {queue.ghostOffer && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 motion-safe:animate-fade-up"
            data-testid="ghost-offer"
          >
            <p className="text-sm text-sky-100">
              No opponent yet. Play a <strong>replay</strong> of a real player&apos;s past run while
              you wait?
            </p>
            <Button size="sm" onClick={onGhost} loading={ghostBusy}>
              Play a ghost now
            </Button>
          </div>
        )}
      </Panel>
    );
  }
  return (
    <Panel title="Ranked">
      <p className="text-sm text-ink-muted">
        Get matched with a player of similar {CATEGORY_LABELS[choice.category]} ELO. Wins and losses
        change your rating in that category only.
      </p>
      <Button
        onClick={onPlay}
        loading={busy}
        disabled={disabled}
        size="lg"
        className="w-full font-display tracking-wide uppercase"
      >
        Play ranked
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="text-xs text-ink-subtle">
          👻 Replay a real player&apos;s past ranked run (or a 🤖 bot). Half the rating change.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={onGhost}
          loading={ghostBusy}
          disabled={disabled}
        >
          Play vs ghost
        </Button>
      </div>
    </Panel>
  );
}

function RoomPanel({ room, busy, disabled, onCreate, onClose }) {
  const selectId = useId();
  const [difficulty, setDifficulty] = useState('ANY');
  const [copied, setCopied] = useState(null);
  const inviteLink = room ? `${window.location.origin}/join/${room.code}` : '';

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied('error');
    }
  }

  if (room) {
    return (
      <Panel title="Private room" glow="rival">
        <div className="space-y-3 text-center">
          <p className="text-sm text-ink-muted">
            Share this code or the invite link. Unranked: no ELO change.
          </p>
          <p className="text-xs text-ink-subtle" data-testid="room-category">
            {choiceLabel(room)}
          </p>
          <p
            className="font-mono text-4xl font-bold tracking-[0.3em] text-sky-300"
            data-testid="room-code"
          >
            {room.code}
          </p>
          <p className="animate-pulse text-xs text-ink-subtle">
            Waiting for your opponent… (expires in 10 min)
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => copy(inviteLink, 'link')}>
              {copied === 'link' ? 'Link copied!' : 'Copy invite link'}
            </Button>
            <Button variant="secondary" onClick={() => copy(room.code, 'code')}>
              {copied === 'code' ? 'Copied!' : 'Copy code'}
            </Button>
            <Button variant="ghost" onClick={onClose} loading={busy}>
              Close room
            </Button>
          </div>
          {copied === 'error' && (
            <p className="text-xs text-ink-muted">Copy failed. Link: {inviteLink}</p>
          )}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Private room">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={selectId}>
          Difficulty
        </label>
        <Select
          id={selectId}
          data-testid="room-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          options={ROOM_DIFFICULTIES}
          className="min-w-0 flex-1"
        />
        <Button
          variant="secondary"
          onClick={() => onCreate(difficulty)}
          loading={busy}
          disabled={disabled}
        >
          Create private room
        </Button>
      </div>
    </Panel>
  );
}

function JoinPanel({ busy, disabled, onJoin }) {
  const inputId = useId();
  const [code, setCode] = useState('');
  return (
    <Panel title="Join a room">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onJoin(code);
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Room code
        </label>
        <Input
          id={inputId}
          data-testid="room-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={6}
          autoComplete="off"
          className="min-w-0 flex-1 py-2 font-mono tracking-widest uppercase placeholder:tracking-normal"
        />
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={disabled || code.trim().length !== 6}
        >
          Join
        </Button>
      </form>
    </Panel>
  );
}

function initialChoice(fromUrl) {
  if (isCategory(fromUrl)) return { category: fromUrl, track: null };
  const saved = loadItem(CHOICE_KEY);
  if (saved && isCategory(saved.category)) {
    return { category: saved.category, track: TRACK_LABELS[saved.track] ? saved.track : null };
  }
  return { category: 'ALGO', track: null };
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { queue, room, notice, setQueue, setRoom, setNotice } = usePlayStore();
  const socketStatus = useConnectionStore((s) => s.socketStatus);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [choice, setChoice] = useState(() => initialChoice(searchParams.get('category')));
  const rating = user.ratings?.[choice.category] ?? user;
  const options =
    choice.category === 'ALGO'
      ? {}
      : {
          category: choice.category,
          ...(choice.category === 'FRONTEND' && { track: choice.track }),
        };

  function changeChoice(next) {
    setChoice(next);
    saveItem(CHOICE_KEY, next); // per-browser convenience
  }

  // ELO / W-L-D change after every ranked match: refresh them when coming back home.
  useEffect(() => {
    useAuthStore.getState().fetchMe();
  }, []);

  async function act(name, fn) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const idle = !queue && !room;
  const offline = socketStatus !== 'connected';

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-4 py-8 sm:py-12">
      <Card as="section" className="motion-safe:animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Welcome back,</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">{user.username}</h1>
          </div>
          <div className="text-right">
            <p className="eyebrow">{CATEGORY_LABELS[choice.category]} ELO</p>
            <p className="font-mono text-3xl font-bold text-accent" data-testid="elo">
              {rating.elo}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Wins" value={rating.wins} className="text-emerald-300" />
          <Stat label="Losses" value={rating.losses} className="text-red-300" />
          <Stat label="Draws" value={rating.draws} className="text-zinc-300" />
        </dl>
      </Card>

      {user.ghostNoticeDismissed === false && <GhostNoticeBanner />}

      <FormError>{error ?? notice}</FormError>
      {offline && (
        <p className="text-center text-sm text-amber-200" role="status">
          Connecting to the game server…
        </p>
      )}

      {idle && <CategoryPanel choice={choice} onChange={changeChoice} disabled={Boolean(busy)} />}

      <RankedPanel
        queue={queue}
        choice={choice}
        busy={busy === 'queue'}
        disabled={!idle || offline}
        onPlay={() => act('queue', async () => setQueue(await request('queue:join', options)))}
        onCancel={() => act('queue', async () => (await request('queue:leave'), setQueue(null)))}
        onGhost={() =>
          // From the queue, the ghost uses the queue's category; match:found navigates.
          act('ghost', async () => {
            const from = queue ?? options;
            await request(
              'ghost:start',
              from.category && from.category !== 'ALGO'
                ? {
                    category: from.category,
                    ...(from.category === 'FRONTEND' && from.track && { track: from.track }),
                  }
                : {},
            );
          })
        }
        ghostBusy={busy === 'ghost'}
      />
      {!queue && (
        <>
          <RoomPanel
            room={room}
            busy={busy === 'room'}
            disabled={!idle || offline}
            onCreate={(difficulty) =>
              act('room', async () =>
                setRoom(await request('room:create', { difficulty, ...options })),
              )
            }
            onClose={() => act('room', async () => (await request('room:leave'), setRoom(null)))}
          />
          {!room && (
            <JoinPanel
              busy={busy === 'join'}
              disabled={offline}
              onJoin={(code) => act('join', () => request('room:join', { code }))}
            />
          )}
        </>
      )}

      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-ink-subtle">
        <Link to="/problems" className="rounded hover:text-ink">
          Practice problems
        </Link>
        <Link to="/leaderboard" className="rounded hover:text-ink">
          Leaderboard
        </Link>
        {import.meta.env.DEV && (
          <Link to="/dev/status" className="rounded hover:text-ink">
            Dev status
          </Link>
        )}
      </p>
    </main>
  );
}
