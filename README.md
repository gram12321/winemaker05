# Winemaker05

Winemaker05 is the next iteration of the Winemaker wine-production and business simulation. Its simulation and player experience are being redesigned from the [Winemaker04 reference](https://github.com/gram12321/winemaker04).

This repository currently contains design context, working-document templates, and agent tools. There is no application, package manifest, or configured test suite yet. The intended alpha stack is TypeScript, Vite, and React for the application shell, with PixiJS for the layered 2.5D scene layer; implementation and exact dependency versions remain pending.

## Start here

- [Agent guide](AGENTS.md) — project workflow and boundaries.
- [Transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) — established direction, proposals, open decisions, and 04 references.
- [System migration research](docs/WorkingDocs/Winemaker04_to_05_System_Migration_Research.md) — authorized inventory and migration direction for supporting systems.
- [Project information](docs/WorkingDocs/PROJECT_INFO.md) — verified repository status and tooling.
- [Documentation workflow](docs/WorkingDocs/documentation-workflow.md) — what each document owns and when to update it.
- [Session-start prompt](docs/WorkingDocs/session-start-prompt.md) — reusable context for a new development session.
- [Winemaker game skill](skills/winemaker-game/SKILL.md) — route work to the relevant local skills.

There are no application setup, run, or test commands until an application toolchain is introduced. Record verified commands in project information when that happens.
