# Testing and Development Tools

Winemaker05 uses Vitest for focused domain, client, authority/API, PostgreSQL, and simulated-UI checks, and Playwright for browser flows. The exact commands, isolated database environment variables, and module ownership are in [project information](PROJECT_INFO.md). The [active core-game plan](../../plans/2026-11-21-core-game-transition.md) is the evidence register for the current vineyard-to-sale integration gates.

## Verification workflow

- For a domain change, run the smallest focused scenario suite for the affected rules and important negative boundaries. Keep game rules deterministic and test through stable public interfaces.
- For cross-domain changes, exercise the company command boundary or HTTP/API path after focused domain checks. For persistence changes, use only disposable local PostgreSQL databases with the explicit environment gates in [project information](PROJECT_INFO.md).
- The core-game loop has focused suites under [tests/game](../../tests/game/) and [tests/api/game-loop.test.ts](../../tests/api/game-loop.test.ts), plus the opt-in real-browser [local PostgreSQL flow](../../tests/e2e/local-postgres.pw.ts). Useful focused commands include `npm test -- tests/game/core-loop.test.ts`, `npm test -- tests/api/game-loop.test.ts`, and `npx playwright test tests/e2e/local-postgres.pw.ts` with its required isolated database configuration. A test file existing is not evidence that the test passed; consult the plan's current verification register.
- Run `npm run typecheck` and `npm run build` at an integration gate or when the change requires them. `npm test` runs Vitest; PostgreSQL tests opt in via their environment URLs. `npm run test:e2e` runs the configured Playwright project with one worker for stable canvas and authority checks. Finish source edits before running the browser gate so Vite reloads do not reset active forms. Chromium may be installed with `npx playwright install chromium` when unavailable.
- UI tests that mock Pixi or use a simulated DOM do not establish canvas output or a real browser layout. Use a browser check for a complete player flow or material UI change.
- For documentation-only changes, read the changed pages, check relative links and terminology, and run `git diff --check`. Application tests and builds are unnecessary unless runtime behavior changed.
- Report exact checks and results. Do not infer integration, browser, or remote-database success from source inspection or test presence.

## Test isolation and remote boundaries

The PostgreSQL suites create and remove their own uniquely identified test data and may install the private schema into an explicitly configured disposable database. The current `schema.sql` drops and recreates the Winemaker05 private schema, so never target an existing application database. Local PostgreSQL tests validate local adapter and HTTP behavior; they do not validate Supabase role grants, production routing, or deployment operations.

The prior read-only Supabase pooler inspection and its limits are documented in [application flow](application-flow.md) and [project information](PROJECT_INFO.md). The current core-game work did not change remote Supabase data or establish a new remote browser/write gate.

## Available agent helpers

- The 04-derived [visual companion](../../skills/superpowers/brainstorming/visual-companion.md) can present local design options; it requires Node.js and does not establish a 05 UI stack.
- The [delegated-development workflow](../../skills/superpowers/subagent-driven-development/SKILL.md) includes task-brief and review-package helpers. They require Bash; the committed-range review helper does not include uncommitted changes.
- The [project router](../../skills/winemaker-game/SKILL.md) connects the repository workflow with newer general-purpose and conditional technology skills, including PixiJS when it is relevant.

## Optional developer labs

Winemaker04 exposed an interactive Gameflow Lab through a development-only dashboard. Its host adapter depends on 04 game state and is not a 05 tool. Keep automated tests repeatable and separate from any future state-mutating scenario tool. An adapted lab would need an explicit host/composition seam, visible mutation scope, durable fixture identifiers, and cleanup that survives reloads.

The [04 admin feature notes](https://github.com/gram12321/winemaker04/blob/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac/src/lib/features/admin/README.md) and [04 test-suite guide](https://github.com/gram12321/winemaker04/blob/f3f4dadeac2663b4744ca107a87cd1f1ad1122ac/tests/README.md) are historical references, not 05 tools or commands.
