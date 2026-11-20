import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { socket } from '@/lib/socket.js';
import { useAuthStore } from '@/store/authStore.js';
import { useConnectionStore } from '@/store/connectionStore.js';
import { api } from '@/lib/api.js';

/** The current user if the session (cookie) is still valid, retrying a few times; else null. */
async function stillLoggedIn(attempts = 4, delayMs = 600) {
  for (let i = 0; i < attempts; i++) {
    const user = await api.get('/auth/session').then(
      (res) => res.user,
      () => null,
    );
    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * Connects the shared socket only while the user is authenticated and disconnects it on
 * logout. Mount once, at the app root.
 *
 * When the server ends the connection itself (sessions revoked by a password change or
 * "log out of all devices"), the session is re-checked: still valid (this browser got a fresh
 * cookie) → reconnect; revoked → back to the login page with an explanation.
 */
export function useSocketLifecycle() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id);
  const setSocketState = useConnectionStore((s) => s.setSocketState);
  const navigate = useNavigate();
  // The handler below is async and long-lived: always call the latest navigate().
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Mirror socket events into the store.
  useEffect(() => {
    const onConnect = () =>
      setSocketState({ socketStatus: 'connected', socketError: null, everConnected: true });
    const onSession = ({ user }) => setSocketState({ socketUser: user });
    const onDisconnect = async (reason) => {
      setSocketState({ socketStatus: 'disconnected', socketUser: null });
      if (reason !== 'io server disconnect') return; // socket.io reconnects by itself otherwise
      if (useAuthStore.getState().status !== 'authenticated') return;
      // Sessions were revoked. If this browser is the one that changed the password, its fresh
      // cookie may still be on its way (the server revokes before answering): retry briefly.
      const user = await stillLoggedIn();
      if (user) {
        useAuthStore.setState({ user });
        socket.connect();
      } else {
        useAuthStore.setState({
          user: null,
          status: 'guest',
          notice: 'You were logged out because your session was ended on another device.',
        });
        navigateRef.current('/login', { replace: true }); // where the notice is shown
      }
    };
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
      setSocketState({ socketStatus: 'disconnected', everConnected: false });
    };
  }, [status, userId, setSocketState]);
}
