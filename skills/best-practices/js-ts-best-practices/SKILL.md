---
name: js-ts-best-practices
description: Apply JavaScript and TypeScript practices to domain logic, shared types, module boundaries, and safe implementation changes.
metadata:
  source: wshobson/agents
  license: MIT
---

# JavaScript and TypeScript Practices

Use for JS/TS work when that language is present or selected. The 04 stack and paths are not assumptions about 05. Follow the [project router](../../winemaker-game/SKILL.md) for domain context and use the React or PixiJS skills only when relevant.

- Identify state and module ownership before editing. Keep domain calculations and validation separate from UI and persistence adapters.
- Prefer clear domain types, narrow unions, exhaustive handling, and type guards to `any`. Reuse existing shared types where appropriate and update actual consumers when contracts change.
- Put tunable gameplay values in named constants or structured balance data when that improves clarity; avoid duplicating rules or introducing speculative abstractions.
- Keep I/O, async ordering, and error handling explicit. Match current repository conventions and dependency versions instead of importing old 04 hooks or paths.
- Verify changed behavior through a focused public interface when useful, using commands that actually exist in the project.
