import StatusCard from '@/components/StatusCard.jsx';
import { useHealth } from '@/hooks/useHealth.js';
import { useSocketConnection } from '@/hooks/useSocketConnection.js';
import { useConnectionStore } from '@/store/connectionStore.js';

function formatUptime(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function StatusPage() {
  useSocketConnection();
  const { data, error, loading } = useHealth();
  const socketStatus = useConnectionStore((s) => s.socketStatus);

  const apiState = loading ? 'pending' : error ? 'error' : 'ok';
  const dbState = loading ? 'pending' : data?.db === 'ok' ? 'ok' : 'error';
  const socketState =
    socketStatus === 'connected' ? 'ok' : socketStatus === 'connecting' ? 'pending' : 'error';

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
        <StatusCard label="Socket" state={socketState} detail={socketStatus} />
      </section>

      <footer className="text-sm text-zinc-500">
        {data ? `Server uptime ${formatUptime(data.uptime)} · ` : ''}
        refreshes every 5s
      </footer>
    </main>
  );
}
