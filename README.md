# Winemaker05

Winemaker05 is the next iteration of the Winemaker wine-production and business simulation. Its simulation and player experience are being redesigned from the [Winemaker04 reference](https://github.com/gram12321/winemaker04).

The repository contains a navigable alpha UI prototype, design context, working documents, and agent tools. The prototype uses TypeScript, Vite, and React for its shell and PixiJS for placeholder 2.5D scenes. It has no game simulation or persistence yet.

## Start here

- [Agent guide](AGENTS.md) — project workflow and boundaries.
- [Transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) — established direction, proposals, open decisions, and 04 references.
- [System migration inventory](docs/WorkingDocs/Winemaker04_to_05_System_Inventory.md) — proposed disposition of Winemaker04 systems beyond the central wine loop.
- [Project information](docs/WorkingDocs/PROJECT_INFO.md) — verified repository status and tooling.
- [Documentation workflow](docs/WorkingDocs/documentation-workflow.md) — what each document owns and when to update it.
- [Session-start prompt](docs/WorkingDocs/session-start-prompt.md) — reusable context for a new development session.
- [Winemaker game skill](skills/winemaker-game/SKILL.md) — route work to the relevant local skills.

## Development

Requires Node.js 22.12.0 or newer and npm.

```sh
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

See [Project Information](docs/WorkingDocs/PROJECT_INFO.md) for stack and command details. The UI direction is recorded in [design](docs/WorkingDocs/design.md), alongside the [transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md).
