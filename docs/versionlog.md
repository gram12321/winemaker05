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

## Version 0.0011a - Record Supabase setup and verification
**Date:** 2026-11-23 | **Commit(s):** 89f08392d902f92184aff672681b56c381a5a1a1 | **Stats:** +21/-21 across 5 files

### Summary
- Updated the working documents from a prepared-but-unapplied Supabase setup to the verified configured project state.
- Recorded the remote authority and browser smoke results and their cleanup; this commit changed documentation only.

### Changes
- `docs/WorkingDocs/PROJECT_INFO.md` (+4/-4) - record the authorized schema application, database checks, remote loop, and limits.
- `docs/WorkingDocs/Supabase_Core_Game_Setup.md` (+5/-5) - describe the verified project configuration and repeatable setup checks.
- `docs/WorkingDocs/application-flow.md` (+1/-1), `docs/WorkingDocs/design.md` (+1/-1), `plans/2026-11-21-core-game-transition.md` (+10/-10) - align status and evidence with the completed setup.

### Notes
- The documentation records 24 passing database checks, a 52-command temporary authority flow, and a real-browser create/advance/plant/reload smoke. Temporary records were removed. No application deployment was performed.

## Version 0.00011 - Correct core-loop review findings
**Date:** 2026-11-22 | **Commit(s):** 2261b24792ae962045a811526b956abbcb5dd381 | **Stats:** +1,994/-366 across 55 files

### Summary
- Corrected reviewed edge cases across harvest accounting, wine provenance and aging, evaluation, previews, and commercial transactions.
- Added regression coverage for the corrected domain and UI behavior.

### Changes
- `src/game/vineyard/Rules.ts` (+71/-26) - distinguish standing, harvested, and lost crop so later rot cannot remove already harvested grapes or make them harvestable again.
- **NEW FILE:** `src/game/wine/Provenance.ts` (24 lines) - add stable origin identity checks for wine lineage.
- `src/game/wine/Development.ts` (+171/-38), `src/game/wine/Maturation.ts` (+12/-12) - keep wine-development age tied to physical eligibility and retain consistent aging after bottling and blending.
- `src/game/queries/ActionPreviews.ts` (+43/-2) - expose press yield and physical trade-offs through the same command rules used for execution.
- `src/game/commercial/Rules.ts` (+22/-41), `src/game/core/SnapshotValidation.ts` (+46/-10) - align buyer eligibility and current-state invariants with the corrected domain rules.

## Version 0.001 - Implement the connected winery core loop
**Date:** 2026-11-22 | **Commit(s):** 4441d37997d62f5d692d9f0e88fc8c05bb9266bf | **Stats:** +9,327/-190 across 123 files

### Summary
- Implemented a server-authoritative player loop from vineyard establishment and harvest through processing, fermentation, maturation, bottling, assessment, sales, and wine contracts.
- Added the domain rules, queries, commands, and React panels needed to run the loop through the company authority and current PostgreSQL snapshot schema.

### Changes
- `src/game/simulation/AdvanceTime.ts` (+64/-1), **NEW FILE:** `src/game/vineyard/Rules.ts` (267 lines) and **NEW FILE:** `src/game/vineyard/Origin.ts` (125 lines) - advance vineyard growth and weather, calculate feasible staff harvest, and capture origin at harvest.
- **NEW FILE:** `src/game/wine/Operations.ts` (462 lines), **NEW FILE:** `src/game/wine/Development.ts` (211 lines), and **NEW FILE:** `src/game/wine/Maturation.ts` (94 lines) - implement physical lot operations, daily development, maturation, and bottle evolution.
- **NEW FILE:** `src/game/evaluation/Profiles.ts` (455 lines) and **NEW FILE:** `src/game/commercial/Rules.ts` (356 lines) - derive sensory targets and assessments, buyer quotes, sales, reservations, and contract outcomes.
- **NEW FILE:** `src/components/game/Cellar.tsx` (35 lines), **NEW FILE:** `src/components/game/LotActions.tsx` (146 lines), and **NEW FILE:** `src/server/postgres/verify-setup.sql` (201 lines) - connect cellar queries and actions to the UI and add a read-only database setup verifier.

### Notes
- Balance values and catalog data are provisional implementation choices. Full recruitment and training, research, lending, buildings, shared-market settlement, multiplayer trade, leaderboards, hosting, and deployment are outside this core-loop scope.

## Version 0.0006 - Rework player and company access
**Date:** 2026-11-21 | **Commit(s):** afbb2f3f8fed6f7c906bc52cc638ef4d5a6d71ea | **Stats:** +1,040/-528 across 39 files

### Summary
- Reworked access around selectable name-only player profiles and a shared unassigned-company scope.
- Added retained profile-creation intents and company-session handling so uncertain work can be recovered safely.

### Changes
- `src/client/ConnectedApp.tsx` (+46/-142), `src/client/playerProfiles.ts` (+60/-7) - connect profile selection, creation, rename, restoration, and protected pending requests.
- `src/server/api/server.ts` (+44/-96), **NEW FILE:** `src/server/companySessions.ts` (29 lines), and **NEW FILE:** `src/shared/companyScope.ts` (14 lines) - scope company access and retain authority sessions needed for recovery.
- **NEW FILE:** `src/server/playerProfiles.ts` (14 lines), `src/server/postgres/PostgresPlayerProfileStore.ts` (+7/-5) - persist selectable profiles in the server-owned database.

### Notes
- Profiles are shared name selections, not authenticated accounts or a private security boundary. Supabase Auth is not used.

## Version 0.00051 - Replace the experimental login flow with player profiles
**Date:** 2026-11-21 | **Commit(s):** 3ded5e42c3f745748068640ee20d6ef906b9f0e2, fed21eb9d6ec179d07c71017f5c43a8727a3c448 | **Stats:** +768/-466 across 48 commit file records

### Summary
- Replaced the per-profile Supabase Auth experiment with database-backed name-only player profiles and an unassigned-company option.
- Connected profile creation, listing, selection, and company ownership scopes to the server API.

### Changes
- `src/client/ConnectedApp.tsx` (+213/-136 across the two commits), `src/client/playerProfiles.ts` (+41/-8) - move the entry flow to selectable profiles and company scopes.
- `src/server/api/server.ts` (+62/-8), **NEW FILE:** `src/server/postgres/PostgresPlayerProfileStore.ts` (47 lines) - add profile endpoints and persistence.
- **REMOVED:** `src/client/supabase.ts` - remove the temporary per-profile Supabase Auth client in the follow-up commit.

### Notes
- The resulting profile IDs are selectable names, not authenticated users; company ownership by profile ID is not a private authorization boundary.

## Version 0.0005 - Use the current save schema directly
**Date:** 2026-11-17 | **Commit(s):** fab88c9c89fa352a8e99128997b5dc480068eeac | **Stats:** +532/-126 across 28 files

### Summary
- Removed application-level handling for older save versions while Winemaker05 remains pre-release.
- Kept exact current-state validation and the authority's revision and receipt checks for correctness and concurrency.

### Changes
- `src/authority/session.ts` (+1/-5), `src/server/api/server.ts` (+0/-1), `src/server/postgres/PostgresCompanySavePort.ts` (+54/-19) - remove version-compatibility branches from loading and persistence.
- `src/server/postgres/schema.sql` (+10/-4) - document direct recreation of the current development schema and its destructive effect on existing development records.

## Version 0.0004/0.00041 - Establish calendar and server authority
**Date:** 2026-11-16 to 2026-11-17 | **Commit(s):** c64108033ed481e2228b0e1d26213e3d96a6c940, 63978e9724ec1675def2405a0c59f287f5dd02a8 | **Stats:** +14,559/-766 across 164 commit file records

### Summary
- Added the weekly calendar, company command/session boundary, HTTP authority, PostgreSQL company snapshots, and initial React/Pixi connection.
- Established server-side processing of commands and persistent company revisions and receipts.

### Changes
- **NEW FILE:** `src/game/calendar/Calendar.ts` (160 lines), **NEW FILE:** `src/game/simulation/AdvanceTime.ts` (18 lines) - calculate configured weekly calendar advances and produce a candidate transition.
- **NEW FILE:** `src/authority/session.ts` (431 lines), **NEW FILE:** `src/server/api/server.ts` (308 lines) - coordinate company commands, commits, and recovery through a trusted server.
- **NEW FILE:** `src/server/postgres/PostgresCompanySavePort.ts` (477 lines), `src/server/main.ts` (+15/-3) - persist and load company snapshots through the server-side PostgreSQL adapter.
- **NEW FILE:** `src/client/ConnectedApp.tsx` (96 lines) - connect the application shell to the authority.

### Notes
- The first client used Supabase Auth; later entries record its replacement with name-only profile selection. No Supabase Auth is active in the current application.

## Version 0.000d-0.000e - Record migration research and approved architecture
**Date:** 2026-11-13 to 2026-11-15 | **Commit(s):** 7bfa7a201137adb5e4306f130625b95fadbff339, 920cca05eab390494e7185bac23682f709236841 | **Stats:** +1,231/-321 across 13 commit file records

### Summary
- Added the supporting-system migration inventory and distinguished Winemaker04 observations from Winemaker05 direction and open decisions.
- Recorded the accepted 43 architecture and product recommendations separately from proposals and implemented behavior.

### Changes
- **NEW FILE:** `docs/WorkingDocs/Winemaker04_to_05_System_Migration_Research.md` (333 lines), `docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md` (+1/-1, then +2/-0) - document migration scope and clarify that the overview is not an implementation specification.
- **NEW FILE:** `docs/WorkingDocs/Winemaker05_Technical_Architecture_Proposal.md` (545 lines), `docs/WorkingDocs/design.md` (+79/-11) - preserve the proposal and the later approved decision record.

### Notes
- These commits record research and design direction; they do not claim that the described systems were implemented.

## Version 0.0002/0.0003 - Build the React/Pixi alpha shell
**Date:** 2026-11-13 | **Commit(s):** b1b245b7c1501f49fce56067839dcf4d93e3edce, 61413422e8bbded99766e88f019ac96283538ef9 | **Stats:** +2,993/-44 across 27 commit file records

### Summary
- Set up the Vite, TypeScript, React, and PixiJS application shell and added the first estate, winery, cellar, and management navigation.
- Added wine-detail and activity-manager placeholder panels for the approved desktop-first prototype.

### Changes
- **NEW FILE:** `package.json` (29 lines), **NEW FILE:** `src/main.tsx` (16 lines), `src/App.tsx` (+100/-1) - establish and render the application shell.
- **NEW FILE:** `src/components/Management.tsx` (38 lines), **NEW FILE:** `src/components/SceneWorkspace.tsx` (115 lines), **NEW FILE:** `src/components/WineDialog.tsx` (58 lines) - add navigation panels and placeholder wine details.

### Notes
- This alpha was a visual/navigation prototype: time advancement was disabled and the panels did not implement game data or persistence. The connected game loop is recorded in Version 0.001.
