# Code Duel

Real-time 1v1 coding battles. Two players get the same problem, write code in the browser, and
the first correct solution wins. Code runs in a sandbox (Judge0) and results update live over
WebSockets. Players get Elo ratings.

> **Status:** Phase 1 (authentication) is done. Matchmaking and game logic aren't built yet.

## Tech stack

| Layer   | Tools                                                                               |
| ------- | ----------------------------------------------------------------------------------- |
| Client  | React 19, Vite 8, Tailwind CSS 4, React Router 8, Zustand, Socket.io client, Monaco |
| Server  | Node.js 24, Express 5, Socket.io 4, Prisma 7 (MariaDB driver adapter), Zod 4        |
| Data    | MySQL 8.4 (Docker)                                                                  |
| Judge   | Judge0 CE 1.13.1 (Docker, needs cgroup v1, see [Judge0 setup](#judge0-setup))       |
| Auth    | bcryptjs, JWT (jose) in an httpOnly cookie, express-rate-limit                      |
| Testing | Vitest, supertest, socket.io-client                                                 |
| Tooling | npm workspaces, ESLint 10 (flat config), Prettier 3, concurrently                   |

## Prerequisites

- **Node.js 24** (`.nvmrc` pins it: run `nvm use`) and npm 11
- **Docker Engine** with the **Compose v2 plugin** (`docker compose`, not `docker-compose`)
- Your user can run `docker` without sudo
- Free ports: 5173, 4000, 3306 (and 2358 for Judge0)

## Setup

```bash
# 1. Install all workspaces (this also generates the Prisma client)
npm install

# 2. Create env files from the examples, then set real secrets
cp infra/.env.example infra/.env          # MySQL credentials
cp server/.env.example server/.env        # DATABASE_URL must match infra/.env
cp client/.env.example client/.env.local  # optional, everything has a default
cp server/.env.test.example server/.env.test  # only needed for `npm test`

# 3. Start MySQL and wait until it's healthy
npm run db:up

# 4. Apply migrations (and regenerate the Prisma client)
npm run db:migrate

# 5. Start the client and the server
npm run dev
```

Open <http://localhost:5173>. You'll land on **/login**: create an account and you're taken to
the home page. The dev dashboard at <http://localhost:5173/dev/status> shows the API, database,
session and socket state (the socket only connects while you're logged in).

Generate secrets with `openssl rand -hex 24` (DB passwords) and `openssl rand -hex 64`
(`JWT_SECRET`). Use hex or other URL-safe characters for the MySQL password, because it is also
part of `DATABASE_URL`.

## Scripts

Run all of these from the repo root.

| Script                 | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | Starts server (`node --watch`) and client (Vite) with `concurrently` |
| `npm test`             | Server test suite (Vitest + supertest) against `code_duel_test`      |
| `npm run lint`         | ESLint over the whole monorepo                                       |
| `npm run lint:fix`     | ESLint with auto-fix                                                 |
| `npm run format`       | Prettier: format every file                                          |
| `npm run format:check` | Prettier: check only (good for CI)                                   |
| `npm run db:up`        | Starts MySQL in Docker and waits for its healthcheck                 |
| `npm run db:down`      | Stops MySQL (data stays in the `code-duel-mysql-data` volume)        |
| `npm run db:logs`      | Follows MySQL logs                                                   |
| `npm run db:migrate`   | `prisma migrate dev`, then `prisma generate`                         |
| `npm run db:generate`  | Regenerates the Prisma client into `server/src/generated/prisma`     |
| `npm run db:studio`    | Opens Prisma Studio (prints its URL)                                 |

Creating a named migration: `npm run db:migrate -- --name add_something`.
Wiping the database: `npm run db:down -- -v` deletes the volume, then `npm run db:up && npm run db:migrate`.

Workspace-only scripts: `npm run build -w client`, `npm run start -w server`,
`npm run db:deploy -w server` (`prisma migrate deploy`, for production).

## Ports

| Service             | Port | URL                              |
| ------------------- | ---- | -------------------------------- |
| Client (Vite)       | 5173 | http://localhost:5173            |
| Server (Express/WS) | 4000 | http://localhost:4000/api/health |
| MySQL               | 3306 | localhost only                   |
| Judge0 CE API       | 2358 | http://localhost:2358/docs       |

In development the Vite server proxies `/api` and `/socket.io` (WebSocket included) to port 4000,
so the browser talks to one origin and doesn't need CORS.

## Environment variables

**`infra/.env`**: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_PORT`.

**`server/.env`**: validated with Zod at startup (`server/src/config/env.js`). If a value is
missing or invalid, the server exits with a clear error.

| Variable       | Example                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `PORT`         | `4000`                                                                              |
| `NODE_ENV`     | `development` / `test` / `production`                                               |
| `CLIENT_URL`   | `http://localhost:5173` (CORS origin)                                               |
| `DATABASE_URL` | `mysql://codeduel:<password>@localhost:3306/code_duel?allowPublicKeyRetrieval=true` |
| `JWT_SECRET`   | 32+ random characters                                                               |
| `JUDGE0_URL`   | `http://localhost:2358`                                                             |

**`server/.env.test`**: same variables, used only by `npm test`. `DATABASE_URL` must point to a
database whose name ends in `_test` (default `code_duel_test`).

**`client/.env.local`**: `VITE_API_URL` and `VITE_SOCKET_URL`. Leave both empty in development.

## Authentication

### Endpoints

All under `/api/auth`. Bodies are JSON. Every user object contains only public fields:
`id`, `username`, `email`, `elo`, `wins`, `losses`, `draws`, `createdAt`. `passwordHash` is
never returned.

| Method | Path        | Body                            | Success                         | Errors        |
| ------ | ----------- | ------------------------------- | ------------------------------- | ------------- |
| POST   | `/register` | `{ username, email, password }` | `201 { user }` + session cookie | 400, 409, 429 |
| POST   | `/login`    | `{ identifier, password }`      | `200 { user }` + session cookie | 400, 401, 429 |
| POST   | `/logout`   | none                            | `204`, clears the cookie        | none          |
| GET    | `/me`       | none (needs the cookie)         | `200 { user }`                  | 401           |

- `username`: 3–20 characters, letters, numbers and `_`. Unique, case-insensitive
  (MySQL's default collation), so `Alice` and `alice` can't both exist.
- `email`: valid address, trimmed and stored lowercased.
- `password`: at least 8 characters and at most 72 bytes (bcrypt ignores anything past 72 bytes,
  so longer passwords are rejected instead of silently truncated). Hashed with bcryptjs, cost 12.
- `identifier`: a username or an email (anything containing `@` is treated as an email).
- `/register` and `/login` are rate-limited to **10 requests per 15 minutes per IP** (each route
  counts separately, in memory, reset on server restart).

### Error format

Every error response has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { "username": ["Username must be at least 3 characters"] }
  }
}
```

| Status | `code`                | When                                                                             |
| ------ | --------------------- | -------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`    | Zod validation failed; `details` maps each field to its messages                 |
| 400    | `INVALID_JSON`        | Malformed JSON body                                                              |
| 401    | `INVALID_CREDENTIALS` | Wrong login. Same response whether or not the account exists                     |
| 401    | `UNAUTHORIZED`        | Missing, invalid or expired session                                              |
| 404    | `NOT_FOUND`           | Unknown route                                                                    |
| 409    | `CONFLICT`            | Username or email taken, e.g. `details: { "email": ["Email is already taken"] }` |
| 429    | `RATE_LIMITED`        | Too many login/register attempts                                                 |
| 500    | `INTERNAL_ERROR`      | Anything unexpected (message hidden in production)                               |

Throw `new HttpError(status, code, message, details?)` (`server/src/lib/errors.js`) from any route
to produce one of these.

### Sessions and cookies

- On register/login the server signs a **JWT** (HS256, `JWT_SECRET`, subject = user id, expires
  in **7 days**) and sets it in a cookie named **`token`**: `HttpOnly` (JavaScript can't read it,
  which protects it from XSS), `SameSite=Lax` (not sent on cross-site POSTs, which blocks CSRF),
  `Path=/`, `Max-Age` 7 days, and `Secure` only when `NODE_ENV=production` (so it works over
  plain HTTP on localhost).
- The browser sends the cookie automatically, so the client never handles the token. In
  development, Vite proxies `/api` and `/socket.io`, so everything is same-origin.
- `requireAuth` (`server/src/middleware/requireAuth.js`) verifies the cookie, loads the user from
  the database and sets `req.user` (public fields). A deleted user's token stops working
  immediately.
- **Logout** clears the cookie. The JWT itself isn't revoked server-side (stateless sessions): a
  copied token stays valid until it expires. Rotating `JWT_SECRET` logs everyone out.
- Auth responses are sent with `Cache-Control: no-store`.

### Socket.io

The Socket.io handshake is authenticated with the same cookie
(`server/src/socket/authMiddleware.js`). Unauthenticated connections are rejected with a
`connect_error` whose `message` is `Unauthorized: …` and whose `data` is
`{ code: 'UNAUTHORIZED', message }`. Accepted sockets have `socket.data.user` (public fields), and
the server emits a `session` event with `{ user }` right after connecting.

### Client

- `store/authStore.js` (Zustand) holds `user` and `status` (`loading` → `authenticated` |
  `guest`). `fetchMe()` runs once on app load, so the session survives a page refresh.
- `ProtectedRoute` sends guests to `/login` (and back to the page they wanted after logging in).
  `GuestRoute` sends logged-in users away from `/login` and `/register`.
- `hooks/useSocketLifecycle.js` connects the socket only while authenticated and disconnects it
  on logout.

## Tests

The server has an integration test suite (Vitest + supertest + socket.io-client) covering
registration, validation, duplicates, login by username/email, wrong passwords, `/me`, logout,
rate limiting, socket authentication, and that `passwordHash` never appears in a response.

```bash
cp server/.env.test.example server/.env.test   # once; set the same DB password as server/.env
npm run db:up                                  # MySQL must be running
npm test                                       # or: npm run test:watch -w server
```

- Tests use a separate database, **`code_duel_test`**. It's created and migrated automatically
  (`prisma migrate deploy`) before the run; your dev data isn't touched.
- Every table is emptied before each test, so the setup refuses to run unless the database name
  ends in `_test`.
- Test files run one at a time because they share the database.

## Judge0 setup

[Judge0 CE](https://github.com/judge0/judge0) runs the submitted code in isolated sandboxes. It
isn't needed yet; the server only reads `JUDGE0_URL`.

`infra/judge0/` holds the **official v1.13.1 release** `docker-compose.yml` and `judge0.conf`.
There are two local changes: a compose project name, and the API bound to `127.0.0.1:2358`.
`judge0.conf` contains generated `REDIS_PASSWORD` / `POSTGRES_PASSWORD` values and is gitignored.
`judge0.conf.example` is the untouched official file.

### Requirement: cgroup v1

Judge0 1.13.x uses `isolate` with **cgroup v1**. Check what your host uses:

```bash
stat -fc %T /sys/fs/cgroup/
# tmpfs     → cgroup v1: Judge0 works
# cgroup2fs → cgroup v2: Judge0 submissions fail; see below
```

### Official fix (from the Judge0 release notes)

The release notes target Ubuntu 22.04:

```bash
sudo nano /etc/default/grub
# Add systemd.unified_cgroup_hierarchy=0 to GRUB_CMDLINE_LINUX, e.g.:
# GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"
sudo update-grub
sudo reboot
# after the reboot, this should print "tmpfs":
stat -fc %T /sys/fs/cgroup/
```

> ⚠️ **This fix probably won't work on Ubuntu 25.10+ / 26.04.** systemd 256 refuses to boot on
> cgroup v1 unless you also set `SYSTEMD_CGROUP_ENABLE_LEGACY_FORCE=1`, and **systemd 258 removed
> cgroup v1 support completely**. Ubuntu 26.04 ships systemd 259. Check with
> `systemctl --version`. On those systems, use the VM option below.

### Recommended on newer hosts: Ubuntu 22.04 VM

Run Judge0 in a small Ubuntu 22.04 VM, for example with [Multipass](https://multipass.run).
The cgroup change then only affects the VM:

```bash
sudo snap install multipass
multipass launch 22.04 --name judge0 --cpus 2 --memory 4G --disk 20G
multipass shell judge0
# inside the VM: install Docker, apply the GRUB fix above, reboot the VM, then follow
# "Starting Judge0" with the files from infra/judge0/ (expose port 2358 on the VM:
# change "127.0.0.1:2358:2358" to "2358:2358").
multipass info judge0     # note the IPv4 address
```

Then set `JUDGE0_URL=http://<vm-ip>:2358` in `server/.env`.

### Starting Judge0 (cgroup v1 hosts only)

These are the official steps, using the Compose v2 syntax:

```bash
cd infra/judge0
docker compose up -d db redis
sleep 10
docker compose up -d
sleep 5
```

Smoke test with JavaScript hello world (language id 63 is Node.js in Judge0 CE 1.13.1; confirm
with `curl localhost:2358/languages`):

```bash
curl -s -X POST 'http://localhost:2358/submissions?base64_encoded=false&wait=true' \
  -H 'Content-Type: application/json' \
  -d '{"language_id": 63, "source_code": "console.log(\"hello, world\")"}'
# → {"stdout":"hello, world\n", ..., "status":{"id":3,"description":"Accepted"}}
```

Stop it with `docker compose down` from `infra/judge0`.

## Project structure

```
code-duel/
├── client/                    # React app (Vite)
│   ├── index.html
│   ├── vite.config.js         # Tailwind plugin, @ → src alias, /api + /socket.io proxy
│   └── src/
│       ├── components/        # ProtectedRoute, GuestRoute, form + UI components
│       ├── hooks/             # useApiForm, useHealth, useSocketLifecycle
│       ├── lib/               # api.js (fetch wrapper), socket.js (shared socket)
│       ├── pages/             # Home ("/"), Login, Register, Status ("/dev/status")
│       ├── store/             # authStore, connectionStore (Zustand)
│       ├── App.jsx            # routes
│       ├── index.css          # Tailwind entry
│       └── main.jsx
├── server/                    # Express + Socket.io API
│   ├── prisma/
│   │   ├── schema.prisma      # User, Problem, TestCase, Match, Submission
│   │   └── migrations/
│   ├── prisma.config.js       # Prisma 7 config (schema path, DATABASE_URL)
│   ├── vitest.config.js
│   ├── test/                  # integration tests + setup (test DB, cleanup)
│   └── src/
│       ├── config/env.js      # Zod-validated env
│       ├── controllers/
│       ├── routes/            # /api/health, /api/auth
│       ├── middleware/        # errorHandler, notFound, requireAuth, rateLimit, validate
│       ├── socket/            # Socket.io setup + cookie auth middleware
│       ├── services/          # auth; judge, elo, matchmaker (TODO stubs)
│       ├── validators/        # Zod request schemas
│       ├── lib/               # prisma, jwt, authCookie, publicUser, errors
│       ├── generated/prisma/  # generated Prisma client (gitignored)
│       ├── app.js             # Express app
│       └── index.js           # HTTP server + Socket.io + graceful shutdown
├── infra/
│   ├── docker-compose.yml     # MySQL 8.4
│   ├── mysql/init/            # first-boot SQL (grants needed for Prisma's shadow DB)
│   └── judge0/                # Judge0 CE 1.13.1 compose + config
├── .vscode/                   # editor settings + recommended extensions
├── eslint.config.js           # flat config; React rules apply to client/src only
├── .prettierrc
├── .editorconfig
├── .nvmrc
└── package.json               # npm workspaces + root scripts
```

## Notes

- **Prisma 7** generates a TypeScript client into `server/src/generated/prisma`. Node 24 runs it
  directly through native type stripping, so the server stays plain JS with no build step and no
  `tsx`. Prisma 7 also no longer runs `generate` after `migrate dev`, so `db:migrate` runs both.
- **React Router 8** removed the `react-router-dom` package. Import everything from
  `react-router`.
- The MySQL init script gives the app user `CREATE`/`DROP` on all schemas, because
  `prisma migrate dev` needs a temporary shadow database. **Development only.**
- `?allowPublicKeyRetrieval=true` in `DATABASE_URL` is required with MySQL 8.4's default
  `caching_sha2_password` auth over plain (non-TLS) TCP. Without it, the MariaDB driver can't
  log in after a MySQL restart (`ER_CANNOT_RETRIEVE_RSA_KEY`). That's fine on localhost; in
  production, use TLS instead.
