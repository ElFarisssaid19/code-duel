import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Button from '@/components/Button.jsx';
import FormError from '@/components/FormError.jsx';
import { formatClock } from '@/components/match/format.js';
import { request } from '@/lib/socket.js';
import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';
import { usePlayStore } from '@/store/playStore.js';

const ROOM_DIFFICULTIES = [
  { id: 'ANY', label: 'Any difficulty' },
  { id: 'EASY', label: 'Easy' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HARD', label: 'Hard' },
];

function Stat({ label, value, className = 'text-zinc-100' }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-center">
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl font-semibold ${className}`}>{value}</dd>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function RankedPanel({ queue, busy, disabled, onPlay, onCancel }) {
  if (queue) {
    return (
      <Panel title="Ranked">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-medium text-zinc-100">
              <span
                className="size-2 animate-ping rounded-full bg-emerald-400"
                aria-hidden="true"
              />
              Searching for an opponent…
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-400" aria-live="polite">
              {formatClock(queue.elapsedMs ?? 0)} ·{' '}
              {queue.window ? `±${queue.window} ELO` : 'any ELO'}
            </p>
          </div>
          <Button variant="secondary" onClick={onCancel} loading={busy}>
            Cancel
          </Button>
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Ranked">
      <p className="text-sm text-zinc-400">
        Get matched with a player of similar ELO. Wins and losses change your rating.
      </p>
      <Button onClick={onPlay} loading={busy} disabled={disabled} className="w-full">
        Play ranked
      </Button>
    </Panel>
  );
}

function RoomPanel({ room, busy, disabled, onCreate, onClose }) {
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
      <Panel title="Private room">
        <div className="space-y-3 text-center">
          <p className="text-sm text-zinc-400">
            Share this code or the invite link. Unranked: no ELO change.
          </p>
          <p
            className="font-mono text-4xl font-bold tracking-[0.3em] text-emerald-400"
            data-testid="room-code"
          >
            {room.code}
          </p>
          <p className="animate-pulse text-xs text-zinc-500">
            Waiting for your opponent… (expires in 10 min)
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => copy(inviteLink, 'link')}>
              {copied === 'link' ? 'Link copied!' : 'Copy invite link'}
            </Button>
            <Button variant="secondary" onClick={() => copy(room.code, 'code')}>
              {copied === 'code' ? 'Copied!' : 'Copy code'}
            </Button>
            <Button variant="secondary" onClick={onClose} loading={busy}>
              Close room
            </Button>
          </div>
          {copied === 'error' && (
            <p className="text-xs text-zinc-400">Copy failed. Link: {inviteLink}</p>
          )}
        </div>
      </Panel>
    );
  }
  return (
    <Panel title="Private room">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="room-difficulty">
          Difficulty
        </label>
        <select
          id="room-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
        >
          {ROOM_DIFFICULTIES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
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
        <label className="sr-only" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={6}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3.5 py-2 font-mono tracking-widest text-zinc-100 uppercase outline-none placeholder:tracking-normal placeholder:text-zinc-600 focus:border-emerald-500"
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

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { queue, room, notice, setQueue, setRoom, setNotice } = usePlayStore();
  const socketStatus = useConnectionStore((s) => s.socketStatus);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-4 py-12">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/30">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">Welcome back,</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">{user.username}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">ELO</p>
            <p className="font-mono text-3xl font-bold text-emerald-400" data-testid="elo">
              {user.elo}
            </p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Wins" value={user.wins} className="text-emerald-400" />
          <Stat label="Losses" value={user.losses} className="text-red-400" />
          <Stat label="Draws" value={user.draws} className="text-zinc-300" />
        </dl>
      </section>

      <FormError>{error ?? notice}</FormError>
      {offline && (
        <p className="text-center text-sm text-amber-300">Connecting to the game server…</p>
      )}

      <RankedPanel
        queue={queue}
        busy={busy === 'queue'}
        disabled={!idle || offline}
        onPlay={() => act('queue', async () => setQueue(await request('queue:join')))}
        onCancel={() => act('queue', async () => (await request('queue:leave'), setQueue(null)))}
      />
      {!queue && (
        <>
          <RoomPanel
            room={room}
            busy={busy === 'room'}
            disabled={!idle || offline}
            onCreate={(difficulty) =>
              act('room', async () => setRoom(await request('room:create', { difficulty })))
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/problems"
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          Practice problems →
        </Link>
        <div className="flex items-center gap-4">
          {import.meta.env.DEV && (
            <Link to="/dev/status" className="text-sm text-zinc-500 hover:text-zinc-300">
              Dev status
            </Link>
          )}
          <Button
            variant="secondary"
            loading={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await logout(); // ProtectedRoute then redirects to /login
              } catch {
                setLoggingOut(false);
              }
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </main>
  );
}
