# Project Information

Record verified repository facts here. Check current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

The current application implements a connected, server-authoritative core game spanning vineyard establishment and harvest, physical wine processing and maturation, cellar assessments, and sales/contracts. React screens render current company queries and submit strict domain commands. See the active [core-game transition plan](../../plans/2026-11-21-core-game-transition.md) for exact core-loop, isolated PostgreSQL, and real-browser production-to-sale gate results. The complete vineyard-to-sale and contract flow passed against isolated local PostgreSQL and the configured Supabase PostgreSQL 17.12 authority. Supabase application was authorized on 22 November; the schema reset was applied only after confirming all five target tables were empty. A 52-command remote game-loop smoke passed and temporary rows were removed. Exact evidence is recorded in the plan.

Named player profiles remain database records without a password or private authentication boundary. Their IDs scope companies; unassigned companies are shared across browsers. Profile listing and selection do not use Supabase Auth. Supabase PostgreSQL was reached using the configured pooler with strict CA verification. The current schema was applied transactionally, RLS and anon/authenticated grants were checked across all five private tables, and the unexposed schema was confirmed by an anonymous REST request returning PGRST106. The real authority completed a 52-command game loop, and a live browser smoke created a profile/company, advanced time, established a vineyard, and reloaded the saved state. Both unique test records were removed. Hosting and deployment remain unverified. Player profiles are still selectable names without password authentication; database ownership by profile ID is not a private user security boundary.

Winemaker05 uses the current save shape directly. There is no old-save compatibility path or migration. [schema.sql](../../src/server/postgres/schema.sql) drops and recreates the private Winemaker05 schema, including development data; apply it only where that data may be discarded.

The Winemaker04 reference is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies, data, module paths, and behaviors describe 04 only.

## Repository map

| Area | Purpose |
|---|---|
| [src/game/core](../../src/game/core/) | Company state, exact current-state validation, strict command contracts, pure command routing, and JSON snapshots. |
| [src/game/vineyard](../../src/game/vineyard/) | Grape/site catalogs, crop and weather rules, harvest, and origin projections. |
| [src/game/wine](../../src/game/wine/) | Physical lots, harvest anchors, operations, daily development, maturation, and risk diagnosis. |
| [src/game/evaluation](../../src/game/evaluation/) | Derived sensory/taste profiles, contextual target ranges, fit scoring, and quality/fault composition. |
| [src/game/inventory](../../src/game/inventory/) | Integer quantities, locations, vessel allocation, reservations, and material consumption. |
| [src/game/equipment](../../src/game/equipment/) | Vessel capacity/material/condition and current wine-environment resolution. |
| [src/game/work](../../src/game/work/) | Starter staff and partial harvest-work allocation. |
| [src/game/finance](../../src/game/finance/) | Cash postings, wage arrears, and basic processing costs. |
| [src/game/commercial](../../src/game/commercial/) | NPC buyer profiles, provisional quotes, contract offers/eligibility/deadlines, customer relationships, and sale history rules. |
| [src/game/commands](../../src/game/commands/) | Composes domain-owned rules into candidate company transitions for estate, equipment, wine, and commercial commands. |
| [src/game/simulation](../../src/game/simulation/) | Weekly company transition and daily development of stored lots. |
| [src/game/queries](../../src/game/queries/) | Company/cellar read model, forecasts, quotes, and non-mutating action previews. |
| [src/authority](../../src/authority/) | Trusted-side company session, save-port contract, revision/receipt handling, and outcome recovery. |
| [src/server](../../src/server/) | HTTP host, company-session lifecycle, profile store contract, PostgreSQL adapters, and explicit schema. |
| [src/client](../../src/client/) | Browser connection orchestration, selectable profiles, local selection/intent persistence, company commands, and recovery. |
| [src/shared](../../src/shared/) | Player/company scope, identifier, and name contracts shared by client and authority. |
| [src/components/game](../../src/components/game/) | React gameplay panels and forms for estate, winery, cellar, company, and management. |
| [src/components](../../src/components/) and [src/scene](../../src/scene/) | Application navigation/panels, PixiJS scene rendering, pointer intents, and renderer lifecycle. |
| [tests](../../tests/) | Focused domain, UI, authority/API, PostgreSQL, and browser test sources; database suites are opt-in. |
| [WorkingDocs](.) | Approved design, current behavior, terminology, relationships, tooling, and documentation workflow. |
| [skills](../../skills/) | Local task routers and conditional technology guidance. |
| [versionlog.md](../versionlog.md) | Release-history instructions and future 05 entries. |

## Stack, commands, and ownership

The checked-in [package.json](../../package.json) and lockfile pin TypeScript 7, Vite 8, React 19, PixiJS 8, Vitest 5, Playwright, and PostgreSQL's Node client. Node 22.13 and npm 11 were used locally. The supported Node engine range is recorded in the package manifest. The core-game work added test files but did not add or change npm scripts.

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies; use `npm ci` for a clean lockfile-based installation. |
| `npm run dev` | Start the Vite UI and its local `/api` proxy. |
| `npm run authority` | Start the candidate TypeScript authority. |
| `npm run typecheck` | Type-check source, configuration, and tests. |
| `npm test` | Run Vitest; PostgreSQL integration tests are skipped unless their test URL is supplied. |
| `npm run test:e2e` | Run Playwright flows; the local-PostgreSQL flow requires the environment described below. |
| `npm run build` | Type-check and build the Vite UI. |

The authority loads `.env.local` and requires a server-only PostgreSQL URL (`POSTGRES_POOLER_URL` preferred, with `DATABASE_URL` as fallback), plus optional trusted calendar overrides: `WINEMAKER_WEEKS_PER_SEASON`, `WINEMAKER_SEASONS_PER_YEAR`, `WINEMAKER_START_YEAR`, `WINEMAKER_START_SEASON`, and `WINEMAKER_START_WEEK`. New companies default to 12 weeks per season, 4 seasons per year, year 1, season 1, week 1. The authority encrypts database traffic and verifies the server certificate. Set `POSTGRES_SSL_ROOT_CERT` to the Supabase root CA path when the system trust store cannot verify the pooler certificate. SSL parameters in the database URL are rejected; use the CA setting instead. The authority defaults to `127.0.0.1:3002` and supports `WINEMAKER_HOST` and `WINEMAKER_PORT`. Vite proxies `/api` to that origin by default; set `WINEMAKER_AUTHORITY_ORIGIN` when using another local authority.

[schema.sql](../../src/server/postgres/schema.sql) is not installed automatically. It drops and recreates `winemaker05_private`, including player profiles, saves, receipts, pending attempts, and fences. Only trusted server code may hold database credentials or write these tables. Keep `POSTGRES_POOLER_URL`/`DATABASE_URL` server-only with no `VITE_` prefix. Run `npm run authority` and `npm run dev` in separate terminals. Browser command recovery and last-profile selection use local storage and Web Locks. Deployment must provide equivalent same-origin API routing, TLS, and operational safeguards.

## Isolated PostgreSQL checks

The PostgreSQL adapter suite is opt-in and currently uses `WINEMAKER_POSTGRES_TEST_DATABASE_URL=postgresql://winemaker_test@127.0.0.1:55439/winemaker05_durable_test`, with `npx vitest run tests/postgres`. The separate HTTP-to-PostgreSQL suite uses `WINEMAKER_HTTP_POSTGRES_TEST_DATABASE_URL` for a second disposable local test database and `npx vitest run tests/integration`.

The real-browser local PostgreSQL flow is [local-postgres.pw.ts](../../tests/e2e/local-postgres.pw.ts). It requires `WINEMAKER_E2E_POSTGRES_TEST_DATABASE_URL=postgresql://winemaker_test@127.0.0.1:55439/winemaker05_browser_test` and `WINEMAKER_AUTHORITY_ORIGIN=http://127.0.0.1:55440`, then runs with `npx playwright test tests/e2e/local-postgres.pw.ts`. These suites restrict accepted hosts/database names, create their private schema when absent, and clean up their own uniquely identified records; never point them at existing application data. They do not validate a deployed Supabase project's grants or operational configuration. See [testing and tools](testing-and-tools.md).

## Supabase setup and live verification

The current schema is installed in the configured Supabase project. See [Supabase core-game setup](Supabase_Core_Game_Setup.md) for the canonical reset SQL, read-only verifier, server-only pooler/CA configuration, and smoke instructions. On 22 November the user authorized this setup; read-only preflight established the target private schema was empty before its transactional reset. The verifier passed all 24 catalog/grant/RLS checks, with the private schema deliberately absent from PostgREST exposed schemas. A complete temporary authority loop passed against remote PostgreSQL and was cleaned up. Do not rerun the reset casually: it drops every object and game record in `winemaker05_private`. No hosting/deployment was performed.
