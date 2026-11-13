---
name: pixi-web-app-dev
description: Route PixiJS rendering and related browser application work to the relevant local practices.
---

# Pixi Web Application Development

Use this router when the task actually involves PixiJS. The Winemaker router handles general project work; the presence of this skill does not select PixiJS or any other framework for 05.

## Stack and scope

- Check the installed PixiJS version before relying on version-specific behavior; the bundled PixiJS reference targets version 8.
- Where React is used, it owns DOM presentation and controls; PixiJS owns canvas rendering and interaction surfaces where used.
- Follow approved project direction and current source; do not assume a particular stack or implemented architecture.

## Session start

For substantial work, briefly state the plan and relevant skills or tools. Read the smallest relevant files before acting.

## Suggested boundaries

- Keep deterministic domain logic independent of React, PixiJS, DOM APIs, and persistence adapters where practical.
- Keep PixiJS scenes focused on rendering, input translation, and resource lifecycle.
- Keep React components focused on rendering state and issuing application commands.
- Use one explicit owner for application state; avoid competing sources of truth.
- Keep application composition responsible for connecting state, UI, and rendering.

Apply these boundaries to the structure that actually exists; do not assume modules or features are already implemented.

## Routing

| Task | Skill | Use when |
|---|---|---|
| Routine narrow work | `../toolsskills/small-steps/SKILL.md` | No stronger workflow applies. |
| Product or interaction design | `../superpowers/brainstorming/SKILL.md` | Requirements or trade-offs need exploration. |
| Approved multi-step plan | `../superpowers/executing-plans/SKILL.md` | A plan is approved and ready to implement. |
| New implementation plan | `../superpowers/writing-plans/SKILL.md` | Work is broad, risky, or explicitly needs a durable plan. |
| TypeScript and PixiJS implementation | `../best-practices/typescript-pixi-react/SKILL.md` | Changing rendering, related UI, state, or types. |
| PixiJS v8 API and lifecycle | `../best-practices/pixijs-v8/SKILL.md` | The project uses PixiJS 8 and the change touches its APIs or lifecycle. |
| Browser interaction tests | `../toolsskills/playwright-e2e/SKILL.md` | Adding or changing stable user-visible browser test coverage. |
| Test-first behavior change | `../superpowers/tdd-gram/SKILL.md` | TDD is requested or a focused fail-first cycle is useful. |
| Bug or regression | `../superpowers/systematic-debugging/SKILL.md` | A failure needs root-cause evidence. |
| Hard rendering/input/performance defect | `../superpowers/diagnose/SKILL.md` | Normal debugging cannot isolate it. |
| Architecture review | `../superpowers/improve-codebase-architecture/SKILL.md` | The user asks for a focused design/refactor review. |
| Behavior-preserving cleanup | `../toolsskills/code-cleanup/SKILL.md` | Simplifying existing code without changing behavior. |
| Documentation maintenance | `../toolsskills/documentation-maintenance/SKILL.md` | Creating, revising, or reviewing project documentation. |
| Standalone review | `../superpowers/requesting-code-review/SKILL.md` | The user asks to review existing work without changing it. |
| Post-change code review | `../superpowers/post-change-code-review/SKILL.md` | Broad work, feature completion, or an explicit review request. |
| Completion verification | `../superpowers/verification-before-completion/SKILL.md` | Review thresholds apply or a correctness claim needs fresh evidence. |
| Parallel agents | `../superpowers/dispatching-parallel-agents/SKILL.md` | Delegation is authorized and independent workstreams justify it. |
| Substantial visual verification | `../toolsskills/computer-use-ui-checks/SKILL.md` | A meaningful visible change benefits from a live browser check. |
| Durable handoff | `../toolsskills/handoff/SKILL.md` | A later session needs continuation context. |
| Create or revise local skills | `../toolsskills/write-skills/SKILL.md` | Editing reusable agent skills. |

## Verification

Do not run tests, browser checks, or independent reviews automatically for every small change. Inspect changed paths and choose focused checks for the actual risk. Use review and verification workflows when scope or the request calls for them. Report only checks actually run.

## Documentation

Use the documentation-maintenance skill and [README](../../README.md) to find project documentation. Read only the pages that apply to the requested work. Keep product decisions, proposals, and implemented behavior distinct, and verify implementation claims against current source.
