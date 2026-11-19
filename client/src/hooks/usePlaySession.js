import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { request, socket } from '@/lib/socket.js';
import { useAuthStore } from '@/store/authStore.js';
import { usePlayStore } from '@/store/playStore.js';

/**
 * App-wide duel session (mounted once): restores queue/room state when the socket connects,
 * redirects to a live match when the app is opened, and follows match:found to the match page.
 */
export function usePlaySession() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const { setPresence, setQueue, setRoom, setNotice } = usePlayStore.getState();

  useEffect(() => {
    if (status !== 'authenticated') return;

    async function syncState() {
      try {
        const presence = await request('state:get');
        setPresence(presence);
        if (
          presence.type === 'match' &&
          !window.location.pathname.startsWith(`/match/${presence.matchId}`)
        ) {
          navigate(`/match/${presence.matchId}`);
        }
      } catch {
        // offline: the next connect retries
      }
    }

    const onFound = ({ matchId }) => {
      setQueue(null);
      setRoom(null);
      navigate(`/match/${matchId}`);
    };
    const onQueue = (payload) => setQueue(payload.status === 'searching' ? payload : null);
    const onRoom = (room) => setRoom(room.status === 'open' ? room : null);
    const onMatchError = (error) => setNotice(error.message);

    socket.on('connect', syncState);
    socket.on('match:found', onFound);
    socket.on('queue:status', onQueue);
    socket.on('room:update', onRoom);
    socket.on('match:error', onMatchError);
    if (socket.connected) syncState();
    return () => {
      socket.off('connect', syncState);
      socket.off('match:found', onFound);
      socket.off('queue:status', onQueue);
      socket.off('room:update', onRoom);
      socket.off('match:error', onMatchError);
    };
  }, [status, navigate, setPresence, setQueue, setRoom, setNotice]);
}
