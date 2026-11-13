# Project Information

Record verified repository facts here. Check the current files before relying on this snapshot, and update it when the application, toolchain, commands, or ownership changes.

## Current status

Winemaker05 is at the design and tooling stage. The repository currently has no application source, package manifest, application dependencies, configured test suite, or setup/run/build commands. The intended alpha stack has been selected as TypeScript, Vite, and React for the application shell, with PixiJS for the layered 2.5D scene layer. This is a design decision, not an installed or verified toolchain. The Git repository is initialized and has a configured `origin` remote.

The 04 reference used for this transition is [gram12321/winemaker04 at f3f4dade](https://github.com/gram12321/winemaker04/tree/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac). Its technologies and module paths describe 04 only. The intended 05 alpha stack is recorded below from approved project direction; it is not inferred from the presence of skills.

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

The intended alpha stack is:

- **TypeScript** for application code.
- **Vite** for development and bundling.
- **React with HTML/CSS** for navigation, panels, modals, and other accessible shell UI.
- **PixiJS** for layered, fixed-composition 2.5D scenes. The design does not require a freely rotating 3D camera or dynamic lighting.

No application source, package manifest, dependencies, commands, or module ownership have been verified or created. Pin the PixiJS version and record actual setup/run/build/test commands when scaffolding begins. Keep domain simulation and persistence separate from the React and PixiJS presentation layers.
