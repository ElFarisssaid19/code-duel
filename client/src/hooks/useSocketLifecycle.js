import { useEffect } from 'react';
import { socket } from '@/lib/socket.js';
import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';

/**
 * Connects the shared socket only while the user is authenticated and disconnects it on
 * logout. Mount once, at the app root.
 */
export function useSocketLifecycle() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  const setSocketState = useConnectionStore((s) => s.setSocketState);

  // Mirror socket events into the store.
  useEffect(() => {
    const onConnect = () => setSocketState({ socketStatus: 'connected', socketError: null });
    const onSession = ({ user }) => setSocketState({ socketUser: user });
    const onDisconnect = () => setSocketState({ socketStatus: 'disconnected', socketUser: null });
    const onConnectError = (err) =>
      setSocketState({ socketStatus: 'disconnected', socketUser: null, socketError: err.message });

    socket.on('connect', onConnect);
    socket.on('session', onSession);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    return () => {
      socket.off('connect', onConnect);
      socket.off('session', onSession);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [setSocketState]);

  // Connect while logged in (re-connects if the user changes).
  useEffect(() => {
    if (status !== 'authenticated') return;

    setSocketState({ socketStatus: 'connecting', socketError: null });
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [status, userId, setSocketState]);
}
