# Project Information

Record verified repository facts here. Check the current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

The React/Pixi prototype connects to Supabase Auth and a PostgreSQL-backed authority for company creation, loading and calendar advancement. Name-only players use anonymous Supabase identities; anonymous sign-in is enabled and the current private schema is installed in the configured development project. Anonymous players depend on browser-held sessions and cannot yet link an account for recovery. The supplied shared session pooler was tested with certificate verification. An earlier isolated synthetic-identity test created, advanced, retried and reloaded a company against the development database and removed it afterward. A full browser sign-in and company session against the configured remote project has not been verified in this work. Wine, vineyard, work, finance, market and other gameplay systems remain unimplemented. Deployment has not been verified.

The 04 reference used for this transition is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies and module paths describe 04 only.

## Repository map

| Area | Purpose |
|---|---|
| [src/game](../../src/game/) | Deterministic company state, calendar validation, commands and synchronous transitions. No browser or database access. |
| [src/authority](../../src/authority/) | Trusted-side company session, save-port contract, revision/receipt handling and outcome recovery. |
| [src/server](../../src/server/) | Candidate authenticated HTTP host and owner-scoped PostgreSQL adapter; the SQL schema is installed explicitly. |
| [src/client](../../src/client/) | Browser player selection and session persistence, Supabase authentication, company API and uncertain-command recovery. |
| [src/components](../../src/components/) | React navigation, panels and transient prototype state. |
| [src/scene](../../src/scene/) | PixiJS scene drawing, pointer intents and renderer lifecycle. |
| [tests](../../tests/) | Focused simulation, session, API, PostgreSQL and UI tests; the database suite is opt-in. |
| [WorkingDocs](.) | Design context, implemented behavior, terminology, and documentation workflow. |
| [skills](../../skills/) | Local task routers and conditional technology guidance. |
| [versionlog.md](../versionlog.md) | Release-history instructions and future 05 entries. |

## Stack, commands, and ownership

The checked-in [package.json](../../package.json) and lockfile pin TypeScript 7, Vite 8, React 19, PixiJS 8, Vitest 5, Playwright, PostgreSQL's Node client, Supabase JS, and the JWT verification library. Node 22.13 and npm 11 were used locally. The Node engine range is recorded in the package manifest.

| Command | Purpose |
|---|---|
| `npm install` | Install the pinned dependency graph; use `npm ci` for a clean lockfile-based installation. |
| `npm run dev` | Start the Vite UI prototype on localhost. |
| `npm run typecheck` | Type-check source, configuration and tests. |
| `npm test` | Run Vitest; PostgreSQL integration tests are skipped unless their test URL is supplied. |
| `npm run test:e2e` | Run the desktop Chromium prototype flow; requires a Playwright Chromium installation. |
| `npm run build` | Type-check and build the Vite UI. |
| `npm run authority` | Start the candidate TypeScript authority with its required environment variables. |

The authority loads `.env.local` and requires a server-only PostgreSQL URL (`POSTGRES_POOLER_URL` preferred, with `DATABASE_URL` as fallback), an HTTPS `SUPABASE_URL` (or `VITE_SUPABASE_URL`), and optional trusted calendar overrides: `WINEMAKER_WEEKS_PER_SEASON`, `WINEMAKER_SEASONS_PER_YEAR`, `WINEMAKER_START_YEAR`, `WINEMAKER_START_SEASON` and `WINEMAKER_START_WEEK`. New companies default to 12 weeks per season, 4 seasons per year, year 1, season 1, week 1. The authority encrypts database traffic and verifies the server certificate. Configure `POSTGRES_SSL_ROOT_CERT` with the Supabase root CA file path when the system trust store cannot verify the pooler certificate. SSL parameters in the database URL are rejected; use the CA setting instead. It defaults to `127.0.0.1:3002` and supports `WINEMAKER_HOST` and `WINEMAKER_PORT`. It verifies ES256 or RS256 bearer tokens against the configured project's signing keys. [schema.sql](../../src/server/postgres/schema.sql) defines the current private 05 schema and is **not** installed automatically on startup. It drops and recreates `winemaker05_private`, including all saves, receipts, pending attempts and fences, so use it only when that development data may be discarded. The schema is already installed in the configured development project; no remote change was made for this task. Only trusted server code may hold database credentials or write its tables. Exposing a service, TLS, deployment and production hardening remain separate work.

For PostgreSQL integration checks, the adapter suite currently requires `WINEMAKER_POSTGRES_TEST_DATABASE_URL=postgresql://winemaker_test@127.0.0.1:55439/winemaker05_durable_test` and runs with `npx vitest run tests/postgres`. For the separate HTTP-to-PostgreSQL suite, set `WINEMAKER_HTTP_POSTGRES_TEST_DATABASE_URL` to a second disposable local test database and run `npx vitest run tests/integration`. These suites restrict accepted hosts and test database names, create their private schema when absent, and clean up their own uniquely identified records; do not point them at existing application data. They do not validate a deployed Supabase project's role grants or operational configuration. See [testing and tools](testing-and-tools.md).


For local development, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLIC_ANON_KEY` to the project URL and publishable key. Put the Supabase Session pooler URL in `POSTGRES_POOLER_URL` or the direct PostgreSQL URL in `DATABASE_URL`; keep both server-only with no `VITE_` prefix. Calendar variables may be omitted to use the selected 12-week, four-season year-1 starting calendar; existing saved calendars retain their rules. Run `npm run authority` and `npm run dev` in separate terminals. Vite proxies `/api` to `127.0.0.1:3002` by default; set `WINEMAKER_AUTHORITY_ORIGIN` when starting Vite to use another local authority. The browser needs available local storage and Web Locks for safe command recovery and same-origin tab coordination. Deployment must provide equivalent same-origin routing. A Supabase publishable key is not a database password or user access token. Before release, use the current schema directly; no compatibility layer or migration is maintained.
