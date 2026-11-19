import { Link } from 'react-router';
import StatusCard from '@/components/StatusCard.jsx';
import { useHealth } from '@/hooks/useHealth.js';
import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';

function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

function socketDetail({ socketStatus, socketUser, socketError }, authStatus) {
  if (socketStatus === 'connected') {
    return socketUser ? `connected as @${socketUser.username}` : 'connected';
  }
  if (socketStatus === 'connecting') return 'connecting…';
  if (authStatus === 'guest') return 'disconnected (log in to connect)';
  return socketError ? `disconnected: ${socketError}` : 'disconnected';
}

/** Dev dashboard (public): API, database, session and socket state. */
export default function StatusPage() {
  const { data, error, loading } = useHealth();
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const socketState = useConnectionStore();

  const apiState = loading ? 'pending' : error ? 'error' : 'ok';
  const dbState = loading ? 'pending' : data?.db === 'ok' ? 'ok' : 'error';
  const authState =
    authStatus === 'authenticated' ? 'ok' : authStatus === 'loading' ? 'pending' : 'error';
  const socketIndicator =
    socketState.socketStatus === 'connected' && socketState.socketUser
      ? 'ok'
      : socketState.socketStatus === 'disconnected'
        ? 'error'
        : 'pending';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Code <span className="text-emerald-400">Duel</span>
        </h1>
        <p className="text-zinc-400">Development environment status</p>
      </header>

      <section className="space-y-3" aria-label="Service status">
        <StatusCard
          label="API"
          state={apiState}
          detail={loading ? 'checking…' : error ? 'unreachable' : 'ok'}
        />
        <StatusCard
          label="Database"
          state={dbState}
          detail={loading ? 'checking…' : (data?.db ?? 'unknown')}
        />
        <StatusCard
          label="Session"
          state={authState}
          detail={authStatus === 'authenticated' ? `@${user.username}` : authStatus}
        />
        <StatusCard
          label="Socket"
          state={socketIndicator}
          detail={socketDetail(socketState, authStatus)}
        />
      </section>

      <footer className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {data ? `Server uptime ${formatUptime(data.uptime)} · ` : ''}
          refreshes every 5s
        </span>
        <Link to={authStatus === 'authenticated' ? '/' : '/login'} className="hover:text-zinc-300">
          {authStatus === 'authenticated' ? 'Home' : 'Log in'} →
        </Link>
      </footer>
    </main>
  );
}
