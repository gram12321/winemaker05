# Version Log Guide for AI Agents

This file will record meaningful Winemaker05 changes. It begins without Winemaker04 entries. Do not update it during routine implementation or documentation work; the human/release workflow requests a log update after the relevant commits exist. The human owns commits unless explicitly requesting otherwise.

When delegation is explicitly authorized, a dedicated agent may prepare the version-log update; the primary agent remains responsible for checking its evidence. Otherwise handle an explicitly requested update directly.

## Goal and scope

Write clear, factual release notes explaining what changed, where, and why it matters. Include meaningful features, balancing or mechanic changes, architectural changes, major fixes, test infrastructure, and substantial documentation restructures. Skip trivial noise unless bundled with a meaningful change. Group related commits only when they form one logical change set.

## Evidence

- Use the available GitHub MCP/connector commit-list and commit-detail/diff tools for log evidence; do not rely on terminal Git commands as the evidence source.
- Retrieve actual commit data and inspect the changed files or diff for every included commit. Never infer behavior from commit messages alone.
- Verify player-visible and mechanical claims against the reviewed changes. If a commit or its diff is unavailable, state the missing evidence and do not invent an entry.
- For grouped entries, list the exact commit hashes, date range, and aggregate statistics without counting merge diffs twice.

## Required entry format

```md
## Version <tag> - <short title>
**Date:** YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD | **Commit(s):** <hash or comma-separated hashes> | **Stats:** <summary>

### Summary
- 1–3 bullets describing intent and outcome.

### Changes
- `path/to/file` (+A/-D) - what changed and why it matters.
- **NEW FILE:** `path/to/new-file` (<line count> lines) - purpose.
- **REMOVED:** `path/to/old-file` - why it was removed or replaced.

### Notes
- Relevant migration, compatibility, balancing, follow-up, or limitation notes.
```

Keep entries concrete and technical, prefer actual paths to vague statements, and use the `NEW FILE` and `REMOVED` markers exactly. Keep length proportional to the change; the 04 heuristic was fewer than ten log lines for a small commit unless its behavior impact is broad. Put newest entries immediately below this guide in reverse chronological order.

## Entries

No Winemaker05 release entries yet.
