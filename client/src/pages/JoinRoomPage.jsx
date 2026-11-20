import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import Spinner from '@/components/ui/Spinner.jsx';
import { request, socket } from '@/lib/socket.js';

/**
 * Invite link target (/join/:code). Protected: guests log in first and come back here.
 * On success the server sends match:found and usePlaySession navigates to the match.
 */
export default function JoinRoomPage() {
  const { code } = useParams();
  const [error, setError] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    function join() {
      if (attempted.current) return;
      attempted.current = true;
      request('room:join', { code }).catch((err) => setError(err));
    }
    if (socket.connected) join();
    else socket.once('connect', join);
    return () => socket.off('connect', join);
  }, [code]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      {error ? (
        <>
          <p className="text-lg font-semibold">
            {error.code === 'CANNOT_PLAY_YOURSELF'
              ? 'This is your own room. Send the link to a friend!'
              : error.message}
          </p>
          <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            ← Back home
          </Link>
        </>
      ) : (
        <>
          <Spinner className="size-8 text-emerald-400" />
          <p className="text-zinc-400">
            Joining room <span className="font-mono text-zinc-200">{code.toUpperCase()}</span>…
          </p>
        </>
      )}
    </main>
  );
}
