# Testing and Development Tools

The 05 prototype has a Vite development server, TypeScript checking, and a production build, but no configured application test runner. See [PROJECT_INFO.md](PROJECT_INFO.md) for actual commands. The following practices carry forward the 04 workflow without assuming its test files or game state exist in 05.

## Verification workflow

- During implementation, use a focused check for a changed behavior or a meaningful boundary. Keep domain scenarios deterministic where practical and test observable behavior through stable interfaces.
- For documentation or skill changes, inspect the documents and links; application tests and builds are unnecessary unless runtime behavior changed.
- Run a broader suite/build once on the integrated candidate when cross-cutting risk, a feature-complete gate, or the user request justifies it. After a failure, reproduce and fix with the narrowest relevant check; rerun the broader gate only if warranted.
- Choose visual/browser checks for material UI changes; these complement rather than replace automated tests. Use the relevant current skills and configured project commands.
- Report the exact checks and results. Do not claim a suite, UI, or backend was verified when it was not.

## Available agent helpers

- The 04-derived [visual companion](../../skills/superpowers/brainstorming/visual-companion.md) can present local design options; it requires Node.js and does not establish a 05 UI stack.
- The [delegated-development workflow](../../skills/superpowers/subagent-driven-development/SKILL.md) includes the 04-derived task-brief and review-package helpers. They require Bash; the committed-range review helper does not include uncommitted changes.
- The [project router](../../skills/winemaker-game/SKILL.md) connects the 04 workflow with the newer general-purpose and conditional technology skills, including PixiJS when relevant.

## Test data and optional developer labs

Keep normal automated tests isolated and repeatable. Any live persistence smoke test should be explicitly opt-in, use an appropriate isolated environment and identifiable test records, and provide cleanup that survives a page or process reload.

04 exposed an automated test runner and a separate interactive Gameflow Lab through a development-only dashboard. The CLI test suite remained the source of truth; the lab created or mutated game data for manual inspection. Its host adapter depends on 04 game state and is not a 05 tool yet.

If 05 later adapts this workflow, use an explicit host/composition seam, keep automated tests separate from state-mutating scenarios, and restrict development surfaces appropriately (04 used loopback access). Make the mutation scope visible, return results and cleanup reports, and give generated fixtures durable identifiers so cleanup works after a reload. Clearly identify broader admin shortcuts that are not fully reversible. Do not treat 04 fixture code as compatible with an undecided 05 state model.

The [04 admin feature notes](https://github.com/gram12321/winemaker04/blob/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac/src/lib/features/admin/README.md) and [04 test-suite guide](https://github.com/gram12321/winemaker04/blob/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac/tests/README.md) are historical implementation references, not 05 tools or commands.
