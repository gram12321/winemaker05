# Winemaker05

Winemaker05 is the next iteration of the Winemaker wine-production and business simulation. Its simulation and player experience are being redesigned from the [Winemaker04 reference](https://github.com/gram12321/winemaker04).

The repository contains a React/PixiJS prototype connected to an authenticated company authority and PostgreSQL save adapter. Named players can create or load companies and advance their calendars. Wine production and other gameplay systems are not implemented yet. See [application flow](docs/WorkingDocs/application-flow.md) for implemented behavior and its limits.

## Development

Use Node.js 22.12 or newer in the supported Node release lines described in [package.json](package.json):

```sh
npm install
npm run dev
npm test
npm run build
```

Configure the client and authority as described in [project information](docs/WorkingDocs/PROJECT_INFO.md), then run `npm run authority` in a second terminal alongside `npm run dev`. The browser uses Supabase Auth and the local Vite proxy.

The database integration tests are opt-in and require an isolated local PostgreSQL test database. The candidate authority requires a configured PostgreSQL connection and Supabase Auth project; see [project information](docs/WorkingDocs/PROJECT_INFO.md) before running it. Neither the schema nor any remote service is configured automatically.

## Start here

- [Agent guide](AGENTS.md) — project workflow and boundaries.
- [Transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) — established direction, proposals, open decisions, and 04 references.
- [System migration research](docs/WorkingDocs/Winemaker04_to_05_System_Migration_Research.md) — authorized inventory and migration direction for supporting systems.
- [Technical architecture research](docs/WorkingDocs/Winemaker05_Technical_Architecture_Proposal.md) — code ownership, command and tick orchestration, persistence, shared-market authority, and source evidence; approved decisions are in the design record.
- [Project information](docs/WorkingDocs/PROJECT_INFO.md) — verified repository status and tooling.
- [Documentation workflow](docs/WorkingDocs/documentation-workflow.md) — what each document owns and when to update it.
- [Session-start prompt](docs/WorkingDocs/session-start-prompt.md) — reusable context for a new development session.
- [Winemaker game skill](skills/winemaker-game/SKILL.md) — route work to the relevant local skills.
