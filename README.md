# Code Duel

Real-time 1v1 coding battles. Two players get the same problem, write code in the browser, and
the first correct solution wins. Code runs in a sandbox (go-judge) and results update live over
WebSockets. Players get Elo ratings.

> **Status:** Phase 2 is done: authentication, problems, sandboxed code execution and solo
> practice. 1v1 matchmaking and live duels aren't built yet.

## Tech stack

| Layer   | Tools                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------- |
| Client  | React 19, Vite 8, Tailwind CSS 4, React Router 8, Zustand, Socket.io client, Monaco, marked + DOMPurify |
| Server  | Node.js 24, Express 5, Socket.io 4, Prisma 7 (MariaDB driver adapter), Zod 4                            |
| Data    | MySQL 8.4 (Docker)                                                                                      |
| Judge   | go-judge 1.14 (Docker, cgroup v2) with Node.js 26 LTS and Python 3.13 runtimes                          |
| Auth    | bcryptjs, JWT (jose) in an httpOnly cookie, express-rate-limit                                          |
| Testing | Vitest, supertest, socket.io-client                                                                     |
| Tooling | npm workspaces, ESLint 10 (flat config), Prettier 3, concurrently                                       |

## Prerequisites

- **Node.js 24** (`.nvmrc` pins it: run `nvm use`) and npm 11
- **Docker Engine** with the **Compose v2 plugin** (`docker compose`, not `docker-compose`)
- Your user can run `docker` without sudo
- Free ports: 5173, 4000, 3306, 5050
- Linux host with cgroup v2 (the default on current distros); see [go-judge setup](#go-judge-setup)

## Setup

```bash
# 1. Install all workspaces (this also generates the Prisma client)
npm install

# 2. Create env files from the examples, then set real secrets
cp infra/.env.example infra/.env          # MySQL credentials
cp server/.env.example server/.env        # DATABASE_URL must match infra/.env
cp client/.env.example client/.env.local  # optional, everything has a default
cp server/.env.test.example server/.env.test  # only needed for `npm test`

# 3. Build/start MySQL + go-judge and wait until both are healthy
npm run infra:up

# 4. Apply migrations (and regenerate the Prisma client)
npm run db:migrate

# 5. Seed the practice problems (checks every reference solution through go-judge first)
npm run db:seed

# 6. Start the client and the server
npm run dev
```

Open <http://localhost:5173>. You'll land on **/login**: create an account and you're taken to
the home page. **Practice problems** opens the problem list; each problem has an editor where you
can run the samples and submit. The dev dashboard at <http://localhost:5173/dev/status> shows the
API, database, judge, session and socket state (the socket only connects while you're logged in).

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
| `npm run infra:up`     | Builds (if needed) and starts MySQL + go-judge, waits until healthy  |
| `npm run infra:down`   | Stops both (MySQL data stays in the `code-duel-mysql-data` volume)   |
| `npm run infra:logs`   | Follows the logs of both containers                                  |
| `npm run db:up`        | Alias of `infra:up`                                                  |
| `npm run db:down`      | Alias of `infra:down`                                                |
| `npm run db:logs`      | Follows MySQL logs only                                              |
| `npm run db:migrate`   | `prisma migrate dev`, then `prisma generate`                         |
| `npm run db:seed`      | Verifies and upserts the practice problems (idempotent)              |
| `npm run db:generate`  | Regenerates the Prisma client into `server/src/generated/prisma`     |
| `npm run db:studio`    | Opens Prisma Studio (prints its URL)                                 |

Creating a named migration: `npm run db:migrate -- --name add_something`.
Wiping the database: `npm run infra:down -- -v` deletes the volume, then `npm run infra:up && npm run db:migrate && npm run db:seed`.

Workspace-only scripts: `npm run build -w client`, `npm run start -w server`,
`npm run db:deploy -w server` (`prisma migrate deploy`, for production).

## Ports

| Service             | Port | URL                              |
| ------------------- | ---- | -------------------------------- |
| Client (Vite)       | 5173 | http://localhost:5173            |
| Server (Express/WS) | 4000 | http://localhost:4000/api/health |
| MySQL               | 3306 | localhost only                   |
| go-judge API        | 5050 | http://localhost:5050/version    |

In development the Vite server proxies `/api` and `/socket.io` (WebSocket included) to port 4000,
so the browser talks to one origin and doesn't need CORS.

## Environment variables

**`infra/.env`**: `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_PORT`, `JUDGE_PORT` (go-judge, default 5050).

**`server/.env`**: validated with Zod at startup (`server/src/config/env.js`). If a value is
missing or invalid, the server exits with a clear error.

| Variable         | Example                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| `PORT`           | `4000`                                                                              |
| `NODE_ENV`       | `development` / `test` / `production`                                               |
| `CLIENT_URL`     | `http://localhost:5173` (CORS origin)                                               |
| `DATABASE_URL`   | `mysql://codeduel:<password>@localhost:3306/code_duel?allowPublicKeyRetrieval=true` |
| `JWT_SECRET`     | 32+ random characters                                                               |
| `JUDGE_URL`      | `http://localhost:5050` (go-judge REST API)                                         |
| `JUDGE_PROVIDER` | `gojudge` (default; see [Judge architecture](#judge-architecture))                  |

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

The server test suite (Vitest + supertest + socket.io-client) has three layers:

- **Unit tests** (`test/judge/*.test.js` except the integration file): output comparison, go-judge
  status mapping and request units, harness generation, verdict building. The judge provider is
  mocked.
- **Judge integration tests** (`test/judge/judge.integration.test.js`): against the **real
  go-judge container**, in JavaScript and Python. They cover accepted, wrong answer, syntax error,
  runtime error, infinite loop, huge allocation, blocked network, and no access to host files.
- **API tests**: auth, sockets, problems and practice. They check that hidden test data never
  appears in any response, the run/submit rate limit, and saved submissions.

```bash
cp server/.env.test.example server/.env.test   # once; set the same DB password as server/.env
npm run infra:up                               # MySQL AND go-judge must be running
npm test                                       # or: npm run test:watch -w server
```

- Tests use a separate database, **`code_duel_test`**. It's created and migrated automatically
  (`prisma migrate deploy`) before the run; your dev data isn't touched.
- Every table is emptied before each test, so the setup refuses to run unless the database name
  ends in `_test`.
- Test files run one at a time because they share the database.

## go-judge setup

[go-judge](https://github.com/criyle/go-judge) ([docs](https://docs.goj.ac)) runs user code in
nested Linux containers with namespaces, cgroup v2 limits and seccomp. It works on cgroup v2
hosts out of the box: no GRUB changes, no VM.

`infra/go-judge/` builds a custom image following the official multi-stage pattern:

- `Dockerfile`: copies the go-judge binary from `criyle/go-judge:v1.14.1` into `debian:trixie-slim`
  with **Node.js 26.13.1 LTS** (binary from the official `node` image) and **Python 3.13**.
- `mount.yaml`: what the sandbox can see. `/bin`, `/lib`, `/usr` are bind-mounted **read-only**.
  `/w` (the working dir) and `/tmp` are small tmpfs mounts. Nothing else from the image or the
  host is visible.
- `passwd`: a fixed 3-line `/etc/passwd` for the sandbox.

The compose service (`infra/docker-compose.yml`) runs it **privileged** (required: go-judge creates
nested containers and cgroups), with `shm_size: 256m` (its file store lives in `/dev/shm`), bound to
**127.0.0.1:5050 only**, with a healthcheck on `GET /version`.

```bash
npm run infra:up                    # builds the image the first time (~2 min), then starts it
curl -s localhost:5050/version      # {"buildVersion":"v1.14.1",...}
curl -s localhost:5050/config | grep -o '"cgroupType":[0-9]'   # "cgroupType":2
```

> **Security:** anyone who can reach port 5050 can run code. Never expose it beyond localhost or
> a private network.

### Sandbox limits (per run)

| Limit             | Value                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| CPU time          | `timeLimitMs` per test (enforced by the harness) + a whole-run cap of `timeLimitMs × tests + 1 s` (max 20 s) |
| Wall clock        | 2 × CPU cap + 1 s (catches `sleep` and blocking calls)                                                       |
| Memory            | 256 MB (cgroup); Node's heap is capped to match                                                              |
| Processes/threads | 32                                                                                                           |
| stdout / stderr   | 64 KB each (more = runtime error "Output limit exceeded")                                                    |
| Network           | none: the sandbox has its own empty network namespace                                                        |
| Filesystem        | read-only runtimes; writable `/w` and `/tmp` tmpfs (64 MB each)                                              |

go-judge units: `cpuLimit`/`clockLimit` are nanoseconds, `memoryLimit` is bytes
(`server/src/services/judge/providers/gojudge.js`).

## Judge architecture

```
POST /api/practice/:slug/run|submit
  → practice.service      loads the problem + tests (samples only for "run")
  → judge/index.js        judgeSolution(): picks the provider from JUDGE_PROVIDER
  → judge/evaluate.js     builds the harness run, calls runCode, compares outputs
  → judge/harness.js      files: main.{js,py} (harness) + solution.{js,py} (user code); stdin: inputs
  → providers/gojudge.js  POST /run to go-judge, maps statuses, deletes any cached files
```

- **Provider interface** (`server/src/services/judge/index.js`):
  `runCode({ language, files, stdin, timeLimitMs, memoryLimitMb, collectFiles? })` →
  `{ status, message, stdout, stderr, timeMs, memoryKb, exitCode, files }`. To use another engine,
  implement that in `providers/<name>.js`, register it in `PROVIDERS`, and set `JUDGE_PROVIDER`.
- **Function-style problems:** users write a function (`twoSum(nums, target)` /
  `two_sum(nums, target)`). The harness (`judge/harness/javascript.cjs`, `judge/harness/python.py`)
  runs inside the sandbox. It reads the inputs from stdin before any user code loads, calls the
  function once per test with that test's arguments, and writes one JSON line per test (actual
  value, error, console output as "logs", time) to a results file that the provider collects.
- **All tests run in one sandbox execution.** Each test has its own time limit inside the harness
  (a `vm` timeout in JS, `SIGALRM` in Python), so an infinite loop or a thrown error in one test
  doesn't stop the others. If the process is killed (memory, or the whole-run CPU cap), the test
  in progress gets that status and the rest are `SKIPPED`.
- **Expected outputs never enter the sandbox.** The server compares actual vs expected
  (`judge/compare.js`): deep JSON equality, floats within `1e-6`, object key order ignored.
- **Statuses:** `ACCEPTED`, `WRONG_ANSWER`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`,
  `MEMORY_LIMIT_EXCEEDED`, `COMPILE_ERROR` (syntax errors, both languages), `INTERNAL_ERROR`, and
  `SKIPPED` (per test). The submission verdict is the first non-accepted test's status.
- **Known limitation (TODO in both harnesses):** user code runs in the same process as the harness,
  so it could forge result lines or read other tests' inputs. The sandbox still contains it (no
  network, no host files, all limits apply), but a determined user could fake a verdict. Planned
  hardening: one sandbox process per test, or signed result lines.

## Problems & practice API

All endpoints require the session cookie.

| Method | Path                         | Body                 | Returns                                                                     |
| ------ | ---------------------------- | -------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/problems`              | none                 | `{ problems: [{ id, slug, title, difficulty, solved }] }`                   |
| GET    | `/api/problems/:slug`        | none                 | `{ problem: { …, description (markdown), starterCode, samples } }`          |
| POST   | `/api/practice/:slug/run`    | `{ language, code }` | `{ result }`: sample tests only, full details                               |
| POST   | `/api/practice/:slug/submit` | `{ language, code }` | `{ result, submission }`: all tests; saves a `Submission` (`matchId: null`) |

- `language`: `javascript` or `python`. `code`: 1 byte to 20 KB.
- `result`: `{ mode, status, passed, total, timeMs, memoryKb, compileError, tests }`. Sample tests
  include `input`, `expected`, `actual`, `error`, `logs`, `timeMs`. **Hidden tests only include
  `{ index, status, timeMs }`**: no input, expected or actual output, logs or errors (those could
  echo the hidden input). Hidden tests are never sent by `GET /api/problems/:slug` either.
- Run and submit share a rate limit of **1 request per 3 seconds per user** (`429 RATE_LIMITED`).
- `503 JUDGE_UNAVAILABLE` / `503 JUDGE_ERROR` if go-judge is down or fails (nothing is saved).

## Adding a problem

1. Create `server/prisma/seed/problems/<slug>.js` (copy an existing one) with `slug`, `title`,
   `difficulty`, `timeLimitMs` (per test), `functionName: { javascript, python }`,
   `starterCode: { javascript, python }`, a markdown `description`, and `tests`:
   `[{ input: [...args], expected, hidden? }]`. Put **at least 2 sample tests first** (no
   `hidden`), then **at least 6 hidden tests**, including edge cases.
   - Write expected values by hand, or compute generated cases with a simple, independent oracle
     (e.g. brute force) in the problem file, **never** with the reference solution.
   - Use a seeded PRNG (`../random.js`) so generated tests are stable.
   - Pick problems with a single correct answer, or specify an order (e.g. "indices in increasing
     order"): outputs are compared exactly (floats within 1e-6).
2. Add reference solutions: `server/prisma/seed/solutions/<slug>.js` and `<slug>.py`.
3. Register the problem in `server/prisma/seed/problems/index.js`.
4. Run `npm run db:seed`. It validates the definition and runs both reference solutions through
   go-judge against every test. If anything fails, it prints the failing test and writes nothing.

## Project structure

```
code-duel/
├── client/                    # React app (Vite)
│   ├── index.html
│   ├── vite.config.js         # Tailwind plugin, @ → src alias, /api + /socket.io proxy
│   └── src/
│       ├── components/        # ProtectedRoute, GuestRoute, badges, form + UI components
│       │   └── practice/      # CodeEditor (Monaco), ResultsPanel, test value blocks
│       ├── hooks/             # useApiForm, useHealth, useSocketLifecycle
│       ├── lib/               # api, socket, monaco (self-hosted), markdown, storage, verdicts
│       ├── pages/             # Home, Login, Register, Problems, Practice (lazy), Status
│       ├── store/             # authStore, connectionStore (Zustand)
│       ├── App.jsx            # routes
│       ├── index.css          # Tailwind entry
│       └── main.jsx
├── server/                    # Express + Socket.io API
│   ├── prisma/
│   │   ├── schema.prisma      # User, Problem, TestCase, Match, Submission
│   │   ├── migrations/
│   │   └── seed/              # npm run db:seed: problems/, solutions/ (reference), index.js
│   ├── prisma.config.js       # Prisma 7 config (schema path, DATABASE_URL)
│   ├── vitest.config.js
│   ├── test/                  # API + judge tests, setup (test DB, cleanup, go-judge check)
│   └── src/
│       ├── config/env.js      # Zod-validated env
│       ├── controllers/
│       ├── routes/            # /api/health, /api/auth, /api/problems, /api/practice
│       ├── middleware/        # errorHandler, notFound, requireAuth, rateLimit, validate
│       ├── socket/            # Socket.io setup + cookie auth middleware
│       ├── services/          # auth, problem, practice; elo, matchmaker (TODO stubs)
│       │   └── judge/         # provider-agnostic judge: evaluate, compare, harness/, providers/
│       ├── validators/        # Zod request schemas
│       ├── lib/               # prisma, jwt, authCookie, publicUser, errors
│       ├── generated/prisma/  # generated Prisma client (gitignored)
│       ├── app.js             # Express app
│       └── index.js           # HTTP server + Socket.io + graceful shutdown
├── infra/
│   ├── docker-compose.yml     # MySQL 8.4 + go-judge
│   ├── mysql/init/            # first-boot SQL (grants needed for Prisma's shadow DB)
│   └── go-judge/              # Dockerfile (go-judge + Node + Python), mount.yaml, passwd
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
- `prisma migrate dev` refuses to run non-interactively when a migration has warnings (e.g. a new
  unique constraint). In that case, generate the SQL with
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
  into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then run
  `npx prisma migrate deploy` (from `server/`).
- Monaco is bundled locally (not loaded from a CDN) and only on the lazy practice page.
