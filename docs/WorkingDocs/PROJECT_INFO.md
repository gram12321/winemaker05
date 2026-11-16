# Project Information

Record verified repository facts here. Check the current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

The repository contains a navigation-only UI prototype, a pure calendar and command foundation, a trusted-side company session, and a candidate PostgreSQL-backed HTTP authority. These pieces do not yet form a connected playable game: the UI is not connected to the server; the wine, vineyard, work, finance, market, and other simulation systems have not been implemented. No Supabase project, remote schema, account provisioning, or deployment has been configured by this work. [Application flow](application-flow.md) records the implemented behavior and limits.

The 04 reference used for this transition is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies and module paths describe 04 only.

## Repository map

| Area | Purpose |
|---|---|
| [src/game](../../src/game/) | Deterministic company state, calendar validation, commands and synchronous transitions. No browser or database access. |
| [src/authority](../../src/authority/) | Trusted-side company session, save-port contract, revision/receipt handling and outcome recovery. |
| [src/server](../../src/server/) | Candidate authenticated HTTP host and owner-scoped PostgreSQL adapter; the SQL schema is installed explicitly. |
| [src/ui](../../src/ui/) | React navigation, panels and transient prototype state. |
| [src/scenes](../../src/scenes/) | PixiJS scene drawing, pointer intents and renderer lifecycle. |
| [tests](../../tests/) | Focused simulation, session, API, PostgreSQL and UI tests; the database suite is opt-in. |
| [WorkingDocs](.) | Design context, implemented behavior, terminology, and documentation workflow. |
| [skills](../../skills/) | Local task routers and conditional technology guidance. |
| [versionlog.md](../versionlog.md) | Release-history instructions and future 05 entries. |

## Stack, commands, and ownership

The checked-in [package.json](../../package.json) and lockfile pin TypeScript 7, Vite 8, React 19, PixiJS 8, Vitest 5, Playwright, PostgreSQL's Node client, and the JWT verification library. Node 22.13 and npm 11 were used locally. The Node engine range is recorded in the package manifest.

| Command | Purpose |
|---|---|
| `npm install` | Install the pinned dependency graph; use `npm ci` for a clean lockfile-based installation. |
| `npm run dev` | Start the Vite UI prototype on localhost. |
| `npm run typecheck` | Type-check source, configuration and tests. |
| `npm test` | Run Vitest; PostgreSQL integration tests are skipped unless their test URL is supplied. |
| `npm run test:e2e` | Run the desktop Chromium prototype flow; requires a Playwright Chromium installation. |
| `npm run build` | Type-check and build the Vite UI. |
| `npm run authority` | Start the candidate TypeScript authority with its required environment variables. |

The authority requires `DATABASE_URL`, an HTTPS `SUPABASE_URL`, and explicit trusted calendar settings: `WINEMAKER_WEEKS_PER_SEASON`, `WINEMAKER_SEASONS_PER_YEAR`, `WINEMAKER_START_YEAR`, `WINEMAKER_START_SEASON` and `WINEMAKER_START_WEEK`. The game has no selected defaults for these values. The authority defaults to `127.0.0.1:3002` and supports `WINEMAKER_HOST` and `WINEMAKER_PORT`. It verifies ES256 or RS256 bearer tokens against the configured project's signing keys. [schema.sql](../../src/server/postgres/schema.sql) is a new, private 05 candidate schema and is **not** installed on startup. Only trusted server code may hold database credentials or write its tables. Installing the schema, provisioning accounts, exposing a service, TLS, deployment and production hardening are separate work.

For PostgreSQL integration checks, set `WINEMAKER_POSTGRES_TEST_DATABASE_URL` to a disposable **local** test database and run `npx vitest run tests/postgres`. For the separate HTTP-to-PostgreSQL suite, set `WINEMAKER_HTTP_POSTGRES_TEST_DATABASE_URL` to a second disposable local test database and run `npx vitest run tests/integration`. These suites restrict accepted hosts and test database names, create their private schema when absent, and clean up their own uniquely identified records; do not point them at existing application data. They do not validate a deployed Supabase project's role grants or operational configuration. See [testing and tools](testing-and-tools.md).
