# Project Information

Record verified repository facts here. Check the current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

Winemaker05 has a navigable, placeholder-only alpha UI prototype. It has no game simulation, game dataset, persistence, or configured test suite. The Git repository is initialized and has a configured `origin` remote. See [application flow](application-flow.md) for implemented behavior and its limits.

The 04 reference used for this transition is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies and module paths describe 04 only.

## Repository map

| Area | Purpose |
|---|---|
| [README.md](../../README.md) | Project introduction and entry points. |
| [AGENTS.md](../../AGENTS.md) | Repository-wide agent workflow. |
| [WorkingDocs](.) | Design context, implemented behavior, terminology, and document templates. |
| [src](../../src/) | React shell, placeholder content, interface components, and PixiJS scenes. |
| [package.json](../../package.json) | Pinned dependencies and development commands. |
| [versionlog.md](../versionlog.md) | Release-history instructions and future 05 entries. |
| [skills](../../skills/) | Local task routers, workflows, and conditional technology guidance. |
| [Copilot instructions](../../.github/copilot-instructions.md), [Cursor rule](../../.cursor/rules/project-agent-rule.mdc) | Adapters to the shared agent guide. |

## Stack, commands, and ownership

The installed alpha stack is:

- **TypeScript** for application code.
- **Vite** for development and bundling.
- **React with HTML/CSS** for navigation, panels, modals, and other accessible shell UI.
- **PixiJS 8.23.0** for layered, fixed-composition 2.5D scenes. The design does not require a freely rotating 3D camera or dynamic lighting.

Exact direct dependency versions are pinned in [package.json](../../package.json) and [package-lock.json](../../package-lock.json). The package requires Node.js 22.12.0 or newer and npm 10 or newer. The prototype has been run with Node.js 24.18.0 and npm 11.16.0.

| Command | Purpose |
|---|---|
| `npm install` | Install the locked dependencies. |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run build` | Typecheck and create a production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |

[App.tsx](../../src/App.tsx) owns temporary navigation, selection, Activity Manager, and wine-dialog state. [experience.ts](../../src/experience.ts) contains presentation-only placeholder labels and descriptions; [components](../../src/components/) render the interface, and [scene](../../src/scene/) owns the PixiJS scene drawings and canvas lifecycle. Future domain simulation and persistence belong outside these presentation modules.
