# Project Information

Record verified repository facts here. Check the current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

Winemaker05 has a minimal web application bootstrap for the approved alpha UI stack. The placeholder app does not yet implement the designed scenes, panels, game data, or simulation. No application test suite is configured.

The 04 reference used for this transition is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies and module paths describe 04 only. Winemaker05's approved UI stack is recorded in [design.md](design.md).

## Repository map

| Area | Purpose |
|---|---|
| [README.md](../../README.md) | Project introduction and entry points. |
| [AGENTS.md](../../AGENTS.md) | Repository-wide agent workflow. |
| [WorkingDocs](.) | Design context, implemented behavior, terminology, and document templates. |
| [versionlog.md](../versionlog.md) | Release-history instructions and future 05 entries. |
| [skills](../../skills/) | Local task routers, workflows, and conditional technology guidance. |
| [Copilot instructions](../../.github/copilot-instructions.md), [Cursor rule](../../.cursor/rules/project-agent-rule.mdc) | Adapters to the shared agent guide. |

## Stack, commands, and ownership

| Area | Stack or ownership |
|---|---|
| Application shell | React and TypeScript, bundled and served by Vite. |
| 2.5D scenes | PixiJS 8.23.0; React owns shell state and connects to the scene renderer. |
| Styling | Native HTML and CSS; no styling framework is selected. |
| Package manager | npm with exact direct dependency pins and a committed `package-lock.json`. |
| UI source | `src/`; the app bootstrap is a placeholder, not an implemented game flow. |

Requires Node.js 22.12.0 or newer. Verified local environment: Node.js 24.18.0 and npm 11.16.0.

| Command | Purpose |
|---|---|
| `npm install` | Install the pinned dependency tree from the lockfile. |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Run TypeScript checks without emitting files. |
| `npm run build` | Typecheck and create the production bundle in `dist/`. |
| `npm run preview` | Preview the production bundle locally. |

No application test runner is configured. The approved alpha UI scope and visual references remain in the design materials; this bootstrap does not implement their scenes or interactions.
