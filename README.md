# Winemaker05

Winemaker05 is a wine-production and winery-management simulation. Its current core-game implementation covers vineyards and harvest through pressing, fermentation, maturation, bottling, cellar assessment, sales, and wine contracts. The [application flow](docs/WorkingDocs/application-flow.md) describes current behavior, provisional balance values, and integration status.

## Development

Use a supported Node.js version from [package.json](package.json) and install dependencies:

```sh
npm ci
```

Before starting the authority, set its server-only PostgreSQL connection as described in [project information](docs/WorkingDocs/PROJECT_INFO.md), then apply [schema.sql](src/server/postgres/schema.sql) to a disposable database. The script drops and recreates the private Winemaker05 schema. Start a new company in the UI using the current schema; older development saves have no compatibility or migration path. Player profiles are selectable names, not authenticated accounts. For manual Supabase installation and read-only SQL checks, follow [Supabase core-game setup](docs/WorkingDocs/Supabase_Core_Game_Setup.md).

Start the authority with:

```sh
npm run authority
```

Run the UI in a second terminal:

```sh
npm run dev
```

Run the available checks with `npm test`, `npm run typecheck`, `npm run build`, or `npm run test:e2e`. PostgreSQL-backed suites are opt-in and require isolated test databases; see [testing and tools](docs/WorkingDocs/testing-and-tools.md).

## Play

Create or select a player profile, then create a new company (or start an unassigned company). Establish a vineyard, advance time until grapes are ready, and assign staff to harvest. In Winery, press the grapes and choose fermentation settings. In Cellar, inspect development, split or blend lots, move wine between vessels, bottle, forecast, and sell; Management contains finance, contracts, equipment, and work. Advance one week at a time from the top bar.

These selectable profiles and unassigned companies have no password or private authentication boundary. Full recruitment, research, lending, buildings, shared-market settlement, and online leaderboards are outside the current core-loop scope.

## Project guidance

- [Agent guide](AGENTS.md) and [Winemaker game skill](skills/winemaker-game/SKILL.md) describe repository workflow and task routing.
- [Transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) separates established direction, open design decisions, and historical Winemaker04 observations.
- [Project information](docs/WorkingDocs/PROJECT_INFO.md) and [documentation workflow](docs/WorkingDocs/documentation-workflow.md) document verified tooling, ownership, and document responsibilities.
