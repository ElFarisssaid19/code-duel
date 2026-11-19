import { createServer } from 'node:http';
import { io as connect } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { initSocket } from '../src/socket/index.js';
import { getTokenCookie, register, validUser } from './helpers.js';

let httpServer;
let io;
let url;
const clients = [];

beforeAll(async () => {
  httpServer = createServer(app);
  io = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});

afterEach(() => {
  while (clients.length) clients.pop().disconnect();
});

afterAll(async () => {
  await io.close();
});

function open(cookie) {
  const socket = connect(url, {
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: cookie ? { cookie } : {},
  });
  clients.push(socket);
  return socket;
}

/** Resolves with the first of `session` or `connect_error`. */
const outcome = (socket) =>
  new Promise((resolve) => {
    socket.on('session', (payload) => resolve({ type: 'session', payload }));
    socket.on('connect_error', (error) => resolve({ type: 'error', error }));
  });

describe('Socket.io authentication', () => {
  it('rejects connections without a session cookie', async () => {
    const result = await outcome(open());

    expect(result.type).toBe('error');
    expect(result.error.message).toMatch(/Unauthorized/);
    expect(result.error.data).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized: not logged in',
    });
  });

  it('rejects connections with an invalid token', async () => {
    const result = await outcome(open('token=forged.token.value'));

    expect(result.type).toBe('error');
    expect(result.error.data.code).toBe('UNAUTHORIZED');
  });

  it('accepts a logged-in user and reports the authenticated user', async () => {
    const res = await register(request(app));
    const cookie = getTokenCookie(res).split(';')[0];

    const result = await outcome(open(cookie));

    expect(result.type).toBe('session');
    expect(result.payload.user).toMatchObject({ username: validUser.username });
    expect(JSON.stringify(result.payload)).not.toMatch(/passwordHash/);
  });
});
