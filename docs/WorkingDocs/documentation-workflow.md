# Documentation Workflow

Use these documents as complementary views of the same project. This preserves the 04 practice of keeping vocabulary, implemented behavior, ownership, relationships, and release history in distinct places, with the current 05 paths and tools.

## Document ownership

| Need | Document | Update when |
|---|---|---|
| Project entry point | [README.md](../../README.md) | Purpose, setup, or entry points change. Keep it short. |
| Agent workflow | [AGENTS.md](../../AGENTS.md) and [Winemaker game skill](../../skills/winemaker-game/SKILL.md) | Repository rules or task routing change. Tool-specific adapters should point here. |
| New-session context | [session-start-prompt.md](session-start-prompt.md) | Entry points or session-start workflow change. |
| Stable domain vocabulary and naming | [CONTEXT.md](CONTEXT.md) | Terms, stable parameters, or naming decisions are agreed or revised. |
| Approved direction and open decisions | [design.md](design.md) and [transition overview](Winemaker04_to_05_Transition_Overview.md) | A product or architecture decision changes. Preserve proposal and decision status. |
| Supporting-system inventory and migration research | [Winemaker04_to_05_System_Migration_Research.md](Winemaker04_to_05_System_Migration_Research.md) | Source evidence or 05 dispositions change; record agreed direction and remaining decisions in [design.md](design.md). |
| Implemented systems, domain behavior, player flow | [application-flow.md](application-flow.md) | Verified behavior, state ownership, interactions, or implementation status change. |
| Module ownership, stack, and commands | [PROJECT_INFO.md](PROJECT_INFO.md) | Files move or the verified stack, commands, or boundaries change. |
| Variable dependencies and cross-system flow | [VariableRelationshipMap.md](VariableRelationshipMap.md) | A verified relationship, calculation, action, snapshot, or visible dependency changes. Update diagrams and text together. |
| Verification and development tools | [testing-and-tools.md](testing-and-tools.md) | Test policy, commands, or development-tool capabilities change. |
| Current verified problems | [known-issues.md](known-issues.md) | A relevant issue is confirmed or resolved. |
| Asset decisions | [icon-guide.md](icon-guide.md) | A project-specific visual or asset convention is agreed. |
| Feature and cleanup prompts | [feature-design-prompt.md](feature-design-prompt.md), [cleanup-review-prompt.md](cleanup-review-prompt.md) | The reusable worksheets need refinement. |
| Version history | [versionlog.md](../versionlog.md) | A release-history update is explicitly requested after actual commits exist. |

Place each fact in its owning document and link to it from other documents. Verify implementation claims against 05 source. Remove obsolete names rather than documenting an imagined compatibility path.

## From 04 to 05

The 04 paths below are historical names, not files that exist in 05. Their roles have been integrated into the newer layout; their game-specific contents and old plan records were not imported.

| 04 document or workflow | 05 home |
|---|---|
| `readme.md` and `skills/winemaker-game/SKILL.md` | [README.md](../../README.md), [AGENTS.md](../../AGENTS.md), and the [project router](../../skills/winemaker-game/SKILL.md) |
| `CONTEXT.md` | [CONTEXT.md](CONTEXT.md) |
| `docs/AIdocs/AIDescriptions_coregame.md` | [application-flow.md](application-flow.md) |
| `docs/PROJECT_INFO.md` | [PROJECT_INFO.md](PROJECT_INFO.md) |
| `docs/WineSystem_VariableRelationshipMap.md` | [VariableRelationshipMap.md](VariableRelationshipMap.md), retaining diagrams and text |
| `docs/AIdocs/AIpromt_newpromt.md` | [session-start-prompt.md](session-start-prompt.md) |
| `docs/AIdocs/AIpromt_docs.md` and `AIpromt_codecleaning.md` | This guide, [documentation skill](../../skills/toolsskills/documentation-maintenance/SKILL.md), and [cleanup prompt](cleanup-review-prompt.md) |
| `docs/versionlog.md` | [versionlog.md](../versionlog.md), with instructions and an empty 05 history |
| `docs/superpowers/` and `docs/codexplans/` plan archives | Optional 05 plans and their completed/deferred records, as described below |

## Designs and plans

For substantial work, clarify the goal, constraints, and current facts, then use an appropriately sized plan. A durable plan is optional unless requested; use `plans/YYYY-MM-DD-<topic>.md` when one is requested and no other location is specified. Give a durable design or plan an explicit status such as proposed, approved, completed, superseded, or deferred. Preserve completed or deferred records when they are useful for traceability, for example under `plans/completed/` or `plans/deferred/`; do not import 04 plan contents as 05 work.

## Routine update and review

After a change, update only the owners affected by durable decisions, behavior, dependencies, commands, or module moves. Do not write routine version-log entries. For a documentation pass, read changed pages, check relative links, search for stale terms, and use `git diff --check` when Git exists. Report checks actually performed.
