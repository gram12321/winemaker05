---
name: winemaker-game
description: Route Winemaker05 design, implementation, maintenance, documentation, and verification work to the relevant project guidance and local skills.
---

# Winemaker Game

Use this as the project router after reading [AGENTS.md](../../AGENTS.md). Read only the guidance needed for the task. Winemaker04 is a reference; its implementation and its exact variables are not 05 facts.

## Orientation

For substantial or unfamiliar work, check [project information](../../docs/WorkingDocs/PROJECT_INFO.md), then the relevant [design](../../docs/WorkingDocs/design.md), [domain terms](../../docs/WorkingDocs/CONTEXT.md), [implemented flow](../../docs/WorkingDocs/application-flow.md), and [relationship map](../../docs/WorkingDocs/VariableRelationshipMap.md). The [transition overview](../../docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) separates agreed 05 direction from proposals, open decisions, and 04 observations.

Keep inherited potential, mutable development, sensory/evaluation outputs, and commercial context distinct as the 05 design evolves. Exact field names, numbers, lifecycle representation, technology choices, and formulas remain decisions to verify rather than copy from 04.

## Domain change checklist

- For time-driven work, trace the state owner, inputs, actions, process ordering, and derived outputs. Keep domain calculations out of UI and orchestration code.
- When a domain shape changes, update the actual shared contracts and consumers together; use named tunable values where appropriate. Consider persistence and historical snapshots only when they exist.
- Trace sensory and evaluation outputs through their consumers, including commercial uses where relevant. Update the relationship map from 05 source, and use focused scenarios for meaningful boundaries and path-dependent behavior.

## Task routing

| Task | Local skill or guide |
|---|---|
| Routine, narrowly scoped work | [small steps](../toolsskills/small-steps/SKILL.md) |
| Optional help selecting a workflow | [using superpowers](../superpowers/using-superpowers/SKILL.md) |
| Design exploration or unresolved trade-offs | [brainstorming](../superpowers/brainstorming/SKILL.md); [feature design prompt](../../docs/WorkingDocs/feature-design-prompt.md) |
| Broad or risky work needing a plan | [writing plans](../superpowers/writing-plans/SKILL.md), then [executing plans](../superpowers/executing-plans/SKILL.md) |
| Isolated Git work when needed or requested | [using Git worktrees](../superpowers/using-git-worktrees/SKILL.md) |
| Delegated plan tasks or independent parallel work, when authorized | [subagent-driven development](../superpowers/subagent-driven-development/SKILL.md); [parallel agents](../superpowers/dispatching-parallel-agents/SKILL.md) |
| JavaScript or TypeScript implementation | [JS/TS practices](../best-practices/js-ts-best-practices/SKILL.md) |
| React, ShadCN, or Supabase work, only when actually used | [React](../best-practices/react-best-practices/SKILL.md), [ShadCN](../best-practices/shadcn-best-practices/SKILL.md), [Supabase](../best-practices/supabase-best-practices/SKILL.md) |
| PixiJS work, only if selected | [Pixi web app router](../pixi-web-app-dev/SKILL.md); [PixiJS 8](../best-practices/pixijs-v8/SKILL.md) for version 8 |
| Stable browser test coverage or substantial visual checks | [Playwright](../toolsskills/playwright-e2e/SKILL.md); [UI checks](../toolsskills/computer-use-ui-checks/SKILL.md) |
| Test-first behavior work | [TDD](../superpowers/tdd-gram/SKILL.md) |
| Defect, regression, or hard-to-isolate failure | [systematic debugging](../superpowers/systematic-debugging/SKILL.md); [diagnose](../superpowers/diagnose/SKILL.md) |
| Architecture assessment or behavior-preserving cleanup | [architecture](../superpowers/improve-codebase-architecture/SKILL.md); [code cleanup](../toolsskills/code-cleanup/SKILL.md) |
| Review or review feedback | [requesting review](../superpowers/requesting-code-review/SKILL.md); [receiving review](../superpowers/receiving-code-review/SKILL.md); [post-change review](../superpowers/post-change-code-review/SKILL.md) when applicable |
| Documentation or release history | [documentation maintenance](../toolsskills/documentation-maintenance/SKILL.md); [version log](../../docs/versionlog.md) for an explicit release-history task |
| Completion evidence | [verification](../superpowers/verification-before-completion/SKILL.md); [testing and tools](../../docs/WorkingDocs/testing-and-tools.md) |
| Skill authoring or session continuation | [write skills](../toolsskills/write-skills/SKILL.md); [handoff](../toolsskills/handoff/SKILL.md) |
| Explicitly requested interview or terse style | [grill me](../toolsskills/grill-me/SKILL.md); [caveman](../toolsskills/caveman/SKILL.md) |
| Branch/PR wrap-up explicitly requested | [finishing a branch](../superpowers/finishing-a-development-branch/SKILL.md) |

Use the newest matching local guidance rather than running every workflow. A substantial change may involve design, a plan, implementation slices, review, and verification; use isolation and delegation only when justified and authorized. Keep the primary agent responsible for integration. Do not commit or update the version log as part of routine development.
