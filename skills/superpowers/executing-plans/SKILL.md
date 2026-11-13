---
name: executing-plans
description: Execute an approved implementation plan in small verified slices without expanding scope or taking ownership of Git workflow.
---

# Executing Plans

1. Read the plan, relevant working documents, and affected current files.
2. Check outdated assumptions, missing decisions, and stack constraints against current files and approved direction. Resolve routine discrepancies; surface a material decision only when it blocks the dependent work.
3. Complete one planned slice at a time while preserving the approved module and ownership boundaries.
4. Run focused verification appropriate to each slice.
5. Report completed plan items, evidence actually obtained, and remaining work.

Do not automatically create branches, commits, worktrees, dependencies, networking, or persistence. Follow the user's authorization and repository guidance for state-changing actions. If the plan materially contradicts the user's direction or an unresolved decision blocks dependent work, surface the specific issue and continue independent work where possible.
