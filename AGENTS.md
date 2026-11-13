# Winemaker05 Agent Guide

## Start

Read [README.md](README.md), then the smallest relevant working documents and [Winemaker game skill](skills/winemaker-game/SKILL.md). The [transition overview](docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md) distinguishes established 05 direction from proposals, open decisions, and observations about 04. Inspect current source before making implementation claims.

The 04 repository is a reference, not the current implementation. Do not copy its game data, release history, formulas, lifecycle states, or implementation claims into 05 as facts. Use its ideas and code where appropriate only after checking them against the 05 design and task.

## Work flow

- Start with a brief scope and risk check. The 04 format was `AI check: <1-5> - <reason>`, where 1 is clear and low-risk and 5 is broad or uncertain; keep the update useful and proportional.
- For an unclear or substantial change, establish the outcome and relevant design first; plan in reviewable slices when that helps. Follow an existing approved plan when one is provided.
- Use isolation when needed or requested. Delegate only when the user and execution environment authorize it; give any agent a bounded scope, relevant context, ownership, and expected checks. Integrate and verify the combined work.
- Keep domain rules and calculations separate from presentation and persistence. Derive module boundaries, shared types, and tunable constants from the actual application as it develops.
- Verify the selected stack and available commands before relying on them. The 04 stack and the presence of PixiJS skills do not establish the 05 stack. Use PixiJS guidance only when PixiJS is actually relevant.
- Prefer current project interfaces and update callers when they change. Do not add compatibility layers or data migrations merely to preserve 04; consider real 05 data and explicit requirements before changing persistence.
- Before completing meaningful code work, inspect the affected area for misplaced domain or persistence logic, duplicated or hardcoded tunable rules, dead code, and stale imports or exports. Follow established project conventions; fix in-scope issues or report them as follow-up.
- Keep user changes intact. Do not create commits, publish, merge, or make external changes unless requested. Avoid repeated broad checks, dependency installation, and running servers without a task-specific reason.

## Documentation

Use the [documentation workflow](docs/WorkingDocs/documentation-workflow.md) for ownership and update triggers. In particular:

- Record agreed language in [CONTEXT.md](docs/WorkingDocs/CONTEXT.md), approved direction in [design.md](docs/WorkingDocs/design.md), and verified behavior in [application-flow.md](docs/WorkingDocs/application-flow.md).
- Update the [relationship map](docs/WorkingDocs/VariableRelationshipMap.md) when verified cross-domain variables or dependencies change; maintain both the visual and textual explanations.
- Update [PROJECT_INFO.md](docs/WorkingDocs/PROJECT_INFO.md) when the actual stack, commands, module ownership, or implementation status changes.
- Keep [versionlog.md](docs/versionlog.md) for the explicit release-history workflow after commits exist; do not add entries during routine work.

## Verification

Use the smallest checks that provide evidence for the change. Documentation and skill work calls for reading the result, checking links, names, and claims, and using `git diff --check` when a Git repository exists; it does not require an application test or build. For code, run focused checks appropriate to the changed behavior and broaden them at a meaningful integration gate, for cross-cutting risk, or on request. Do not repeat a successful broad check without a relevant change. Report exactly what ran and any meaningful gap. See [testing and development tools](docs/WorkingDocs/testing-and-tools.md).
