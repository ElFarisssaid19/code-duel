import { useEffect } from 'react';
import { socket } from '@/lib/socket.js';
import { useConnectionStore } from '@/store/connectionStore.js';

/** Connects the shared socket while the calling component is mounted and mirrors its state. */
export function useSocketConnection() {
  const setSocketStatus = useConnectionStore((s) => s.setSocketStatus);

  useEffect(() => {
    const onConnect = () => setSocketStatus('connected', socket.id);
    const onDisconnect = () => setSocketStatus('disconnected');
    const onConnectError = () => setSocketStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    setSocketStatus('connecting');
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
      setSocketStatus('disconnected');
    };
  }, [setSocketStatus]);
}
