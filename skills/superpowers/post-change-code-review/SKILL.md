---
name: post-change-code-review
description: Use after code changes that meet the repository's review threshold before reporting the work complete.
---

# Post-Change Code Review

Use this review for work that changes a major mechanic, is broad enough to need a written plan, reaches a feature-complete point, or when the user explicitly requests review. When independent reviewers are authorized and available, choose coverage justified by scope; do not require a fixed count. Otherwise the primary agent reviews the relevant perspectives directly. This review follows implementation and does not replace integration or verification.

Documentation-only, skill-only, and asset-only changes do not trigger this stage. A review-only request uses `../requesting-code-review/SKILL.md` instead.

## Prepare the review

1. Finish the code change and identify every changed code path. Include relevant tests, scripts, and behavior-changing configuration. The primary agent supplies the path list from its work; this workflow requires no issue tracker, commit, branch, diff, or Git command.
2. Write a compact review brief: the user's requested outcome and acceptance criteria; the changed paths and what changed; relevant project documents or interface contracts; and checks actually run with their results. Say when a behavior or rendering check was not performed.
3. Give each reviewer the same brief and permission to read the affected files, callers, and nearby tests. They must inspect the current files rather than trust the change summary. Keep reviewers read-only: no edits, test runs, commits, external comments, or nested delegation.

## Choose review coverage

Consider these review perspectives and choose the coverage that fits the change. One reviewer may cover both; split them across reviewers only when the change's scope makes independent coverage useful.

- **Behavior and scope:** Compare the current implementation and accompanying documentation claims with the user request and approved project direction. Look for missing behavior, incorrect flows, regressions, and unrequested scope. Cite the requirement or behavior behind each finding.
- **Code quality and integration:** Check correctness, edge cases, state ownership, React/PixiJS boundaries, input and coordinate handling, resource cleanup, duplicate rules, dead code, unnecessary rendering work, and speculative abstractions in the changed area. Assess existing verification evidence and follow the affected code across module boundaries where needed.

Each agent returns only concrete, actionable findings ordered Critical, Important, Minor. For each finding, give a current `path:line`, the affected scenario, evidence, impact, and a practical correction. Put uncertain or unverified behavior under **Verification gaps**, not **Findings**. Report “No findings” when appropriate; avoid style preferences and speculative warnings.

## Integrate the review

The primary agent checks each report against the code and requirements, removes duplicates, investigates disagreements, and fixes confirmed issues within the requested scope. After a code fix, repeat a proportionate review focused on the changed area and earlier findings. Continue until confirmed findings are resolved or report a remaining blocker accurately. Choose and report verification according to `AGENTS.md`; reviewer reports are evidence to assess, not proof that an interaction was tested.

If independent reviewers cannot be used or delegation is not authorized, inspect the relevant perspectives directly. Describe the review actually performed and do not claim that independent agents ran when they did not.
