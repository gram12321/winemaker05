---
name: documentation-maintenance
description: Create, revise, move, or review project documentation and verify documentation claims.
---

# Documentation Maintenance

Use [AGENTS.md](../../../AGENTS.md) and the [documentation workflow](../../../docs/WorkingDocs/documentation-workflow.md) to find the owner of each fact. Keep approved decisions, proposals, implemented behavior, and historical 04 observations distinct. Verify implementation claims against current 05 source.

- Keep domain terms in [CONTEXT.md](../../../docs/WorkingDocs/CONTEXT.md), approved direction in [design.md](../../../docs/WorkingDocs/design.md), current behavior in [application-flow.md](../../../docs/WorkingDocs/application-flow.md), and actual tooling and ownership in [PROJECT_INFO.md](../../../docs/WorkingDocs/PROJECT_INFO.md).
- Update the [relationship map](../../../docs/WorkingDocs/VariableRelationshipMap.md) when verified cross-system dependencies change. Keep diagrams and textual descriptions aligned, including owners, timing, derived/persisted state, and evidence when relevant.
- Keep [README.md](../../../README.md) concise. Use relative links and remove stale names or unsupported claims.
- The [version log](../../../docs/versionlog.md) belongs to the explicit release-history workflow after commits exist; do not add routine entries.

For documentation-only work, read the changed pages, check links and terminology, search for stale names, and use `git diff --check` when Git is available. Report only checks performed.
