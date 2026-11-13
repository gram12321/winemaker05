---
name: subagent-driven-development
description: Execute a reviewable implementation plan with bounded delegated tasks when the user and execution environment authorize subagents.
---

# Subagent-Driven Development

Use only when delegation is authorized and available. Otherwise follow [executing plans](../executing-plans/SKILL.md) directly. Do not require commits, a worktree, a particular model, or a subagent for ordinary work.

1. Read the goal, plan, applicable project instructions, and current state. Identify task dependencies and any shared interfaces before dispatch.
2. Give each implementer a bounded outcome, exact requirements, owned paths, relevant context, constraints, and focused verification. Use [implementer prompt](implementer-prompt.md) as a starting point.
3. Assign one owner per writable path in a parallel wave. Keep dependent or shared-file tasks sequential; integrate their results in the primary session.
4. Review requirements and quality against the actual changes and surrounding code, not just the implementer's report. When independent review is authorized and useful, use [task reviewer prompt](task-reviewer-prompt.md).
5. Resolve confirmed findings, rerun proportionate checks after fixes, and track completed tasks and remaining concerns. Finish with the full integrated outcome and evidence, not just individual reports.

The optional 04-derived [task-brief](scripts/task-brief) and [review-package](scripts/review-package) helpers require Bash. From the repository root, invoke them as `bash skills/superpowers/subagent-driven-development/scripts/task-brief PLAN N [OUTFILE]` or `bash skills/superpowers/subagent-driven-development/scripts/review-package BASE HEAD [OUTFILE]`. Default outputs require a Git worktree and use unique names under `.superpowers/sdd/`; check existing ignore rules before use. Explicit output paths must not already exist. A committed-range package omits uncommitted and untracked changes, so inspect those separately. Use the recorded base rather than assuming a single commit. Helpers do not authorize creating commits.
