# Core game transition: implementation and status

Status: twelve-topic review and correction complete; local integration verified as recorded below. Supabase application remains manual. Owner: orchestration agent. Started: 21 November 2026; review started: 22 November 2026.

## Outcome and authority

Deliver a connected, server-authoritative playable loop: create a company, establish a vineyard, grow and harvest grapes, process and ferment physical lots, mature in actual vessels, bottle, inspect and forecast development, sell wine and fulfill wine contracts. Preserve the existing React/Pixi shell, company revision/receipt protection and current-schema validation. No commits, merges, publication, external database changes, compatibility layers or old-save migrations are authorized by this task.

Sources: [transition overview](../docs/WorkingDocs/Winemaker04_to_05_Transition_Overview.md), [approved design](../docs/WorkingDocs/design.md), [architecture evidence](../docs/WorkingDocs/Winemaker05_Technical_Architecture_Proposal.md), [supporting-system inventory](../docs/WorkingDocs/Winemaker04_to_05_System_Migration_Research.md). The twelve topics below are the original twelve comparison rows retained in overview section 9. Section 11 supplies the dependency order; its twelve design steps are not twelve additional subsystems.

## 22 November review and correction pass

Review the existing implementation against current 05 source, approved direction, the 04 reference and the prior research; do not treat earlier agent reports or test results as current proof. Each topic gets a distinct research agent and a subsequent coding agent, including an explicit no-change assessment when the evidence does not justify an edit. Research records concrete findings and ownership; coding resolves confirmed in-scope findings and runs focused checks. The primary agent coordinates shared contracts, integrates cross-domain/UI changes, updates working documents, and runs the final integrated and browser gates. Existing remote-access restrictions remain in force.

| # | Topic | Research | Correction / focused checks | Integration / UI |
|---|---|---|---|---|
| 01 | Vineyard characteristics | Complete: current 05 / 04 review identified partial-harvest rot accounting and inverted drought/drainage response | Implemented: crop ledger and drainage response; 39 focused tests and typecheck passed | Work, preview, tick, inventory and XP tested together; final gate passed |
| 02 | Wine anchors | Complete: current 05 / 04 review found parent provenance validation gap and lost aroma treated as release capacity after blending | Implemented: provenance validation and finite aroma; 64 focused wine, validation and transaction tests and typecheck passed | Final gate passed; exact parent identity limitation noted below |
| 03 | Terroir Potential / Origin Prestige | Complete: signed-year failure, misleading blended origin display and pre-purchase comparison gap | Implemented: signed years, shared land cost and origin query; 19 focused tests passed | Estate comparison and blend sources implemented; 2 focused UI tests passed |
| 04 | Six structural characteristics | Complete: bottled sweetness targets are unreachable for several grapes; press trade-offs are not previewed | Implemented: provisional dry-wine targets/projection; four-grape command scenarios | Query-backed press preview implemented; 39 focused tests and typecheck passed |
| 05 | Moving Structure Index | Complete: target explanation clipping attribution reproduced; 19 evaluator/profile/assessment tests passed | Implemented: accurate clipping explanations and strict source requirement; 15 focused tests passed | Final gate passed |
| 06 | Taste families / descriptors | Complete: idle must acquires aged taste and qualifies for aged contracts; unused quote projections found | Implemented: separate wine-development age and elapsed lot age; 85 focused tests and typecheck passed | Taste, quotes and contracts aligned; cellar displays both ages |
| 07 | Taste Quality Index | Complete: reproduced diagnosis-threshold quality and price jumps; 14 tests passed | Implemented: continuous risk penalty and bottling snapshot checks; 28 focused tests passed | Cellar explains quality policy; final gate passed |
| 08 | Bounded contextual targets | Complete: combined anchor and interaction shifts exceeded the named total axis budget | Implemented: aggregate signed source-weighted cap and explanations; 15 focused tests passed | Final gate passed |
| 09 | Causal features, risks and faults | Complete: causal history omitted environmental drivers; risk/quality threshold concern was disproved on recheck | Implemented: observed daily environmental history; 35 focused tests and strict unused checks passed | Long weekly histories retain complete causes in bounded entries |
| 10 | Fermentation / extraction | Complete: dry-wine fermentation action was mislabeled; perfect temperature control is a provisional model boundary | Implemented: query-backed action label; setpoint and handover checks | 13 UI/equipment tests passed; final browser gate passed after selector correction |
| 11 | Maturation / vessels / bottle evolution | Complete: no reproducible defect found; current ownership and bottle evolution reviewed | Coding agent found no justified change; 60 focused tests passed | Current-condition forecast holds vessel condition fixed; final gate passed |
| 12 | Sales / buyers / contracts | Complete: counter overflow could silently omit a sale while stock and cash changed | Implemented: explicit sale-record failures reject the whole candidate | Direct retry and multi-lot rollback scenarios passed; 29 focused tests and typecheck passed |

Final gate complete: combined ownership, current-state validation and authority boundaries received independent review; full domain/integration, typecheck/build and real-browser vineyard-to-sale checks ran against disposable local services. Evidence and limits are below. Broader supporting subsystems remain outside the core scope stated below.

Review notes: Topic 01 must distinguish material already harvested from standing crop when new rot occurs, without making unripe grapes harvestable through repeated partial harvests. It also needs the correct direction of drought response to drainage. Weather forecasts are part of the broader supporting-system direction but outside this core slice. The initial 24 research reports below describe the pre-implementation baseline and must not be read as current 05 implementation evidence.

Topic 02 review reproduced acceptance of altered one-parent lineage and an old/young blend regaining aroma lost to aging. Exact blend shares cannot be reconstructed from parent IDs alone; validate only provenance the current model actually retains unless a stronger contract is justified. Topic 03 review reproduced a signed calendar year accepted during establishment but rejected during origin projection. For blends, the cellar currently presents the dominant source as if it represented every source; purchase choices also lack a pre-purchase origin comparison.

Topic 04 review traced a command-produced bottled Pinot with sweetness 0.029 against target 0.192–0.392; bottling and target rules need coherent dry-wine tuning. Press settings currently expose no resulting yield or physical trade-offs before commitment. Topic 05 review reproduced explanations that confuse a domain-edge clamp with the movement cap, and misstate an anchor shift clipped at the boundary. Repeated forecast work was observed but its performance impact is not established; avoid speculative caching.

Topic 06 review reproduced aged taste increasing in idle, unfermented must and a collector contract accepting a newly bottled wine whose pre-fermentation storage supplied most of its nominal age. The wine-age definition and its consumers must be made consistent. The review also identified unused per-lot buyer quotes and a duplicated taste-development calculation.

Topic 08 review found that separate anchor and interaction adjustments could exceed the stated total movement budget. The correction will bound their combined shift from the source-weighted base and preserve explanations and the existing one-way interaction model.

### Final review evidence — 22 November

- Fresh `npm test` with both isolated local PostgreSQL suites enabled: 36 files and 314 tests passed. `npm run build` passed, including typecheck; Vite reported its existing large-main-chunk warning.
- The full Playwright run initially passed 11 of 12 tests; the real PostgreSQL production-to-sale test used an obsolete fermentation-button label. After updating that assertion, the two local PostgreSQL browser tests passed, including vineyard, harvest, press/ferment, bottle, sale, reload and contract fulfillment. The other 10 browser tests had passed in the initial run. Desktop 1280×720 and narrow 390×844 cellar screenshots were inspected; the browser test checked no horizontal overflow at the narrow width.
- Independent post-change reviews covered vineyard/work, provenance, wine age and evaluation, commercial transactions, authority, UI and the final history correction. The history issue found in review was corrected and independently re-reviewed. A structured parent ID is the authority for lineage: source baselines can be checked against a parent, but the current retained data cannot independently prove which otherwise-identical sibling was the parent or reconstruct exact blend input proportions. Do not infer those facts from free-form history.
- The prior ignored local environment and user data were not modified. The dedicated local PostgreSQL 16 test cluster was started for these checks and stopped afterward. No Supabase connection or remote change was made; the user's manual setup restriction remains in force. No commits, merges, or publication were made in this review pass. Current-schema fields changed without compatibility or migration code, as directed.

Supporting systems are restricted to what this loop needs: deterministic weather/growth, feasible harvest work, vessel capacity and condition, company cash/postings, NPC wine buyers and contracts. Full recruitment/training, research/grants, lending, shared multiplayer settlement, online rankings, buildings and other inventory subsystems remain outside this task. Open numerical rules are implementation balance choices, documented as provisional rather than falsely reported as previously approved formulas.

## Research, implementation and evidence register

Each topic receives a distinct 05/04 research agent, other-game comparison agent and subsequent coding agent. Default: GPT-6-Luna, max reasoning. The runtime allows three child agents concurrently; waves respect that limit. Research reports live in [transition-research/](./transition-research/). This document is maintained by the primary agent only.

| # | Topic | 05 / 04 research | Other-game research | Implementation | Integration / UI | Evidence |
|---|---|---|---|---|---|---|
| 01 | Vineyard characteristics | Complete: [current](transition-research/01-current.md) | Complete: [comparison](transition-research/01-comparison.md) | Complete: t01_implementation | Live estate, harvest and yearly reset integrated | Vineyard/origin and core scenarios passed |
| 02 | Wine anchors | Complete: [current](transition-research/02-current.md) | Complete: [comparison](transition-research/02-comparison.md) | Complete: t02_implementation | Press/split/blend/bottle with quantities and archive integrated | 11 operations tests; integrated material conservation passed |
| 03 | Terroir Potential / Origin Prestige | Complete: [current](transition-research/03-current.md) | Complete: [comparison](transition-research/03-comparison.md) | Complete: t03_implementation | Shared agricultural suitability, harvest snapshots and commercial origin premium | Origin and commercial tests passed |
| 04 | Six structural characteristics | Complete: [current](transition-research/04-current.md) | Complete: [comparison](transition-research/04-comparison.md) | Complete: t04_implementation_and_ui (Terra, max) | Live panels and queries integrated; desktop/narrow browser gate passed | 6 sensory tests, 3 UI interactions passed |
| 05 | Moving Structure Index | Complete: [current](transition-research/05-current.md) | Complete: [comparison](transition-research/05-comparison.md) | Complete: t05_implementation | Shared assessment evaluator integrated | 7 evaluator tests passed |
| 06 | Taste families / descriptors | Complete: [current](transition-research/06-current.md) | Complete: [comparison](transition-research/06-comparison.md) | Complete: t06_implementation | Current cellar profile and buyer preferences integrated | 4 taste tests passed |
| 07 | Taste Quality Index | Complete: [current](transition-research/07-current.md) | Complete: [comparison](transition-research/07-comparison.md) | Complete: t07_implementation | Separate structure/taste/fault assessment and bottling snapshots | 5 assessment tests passed |
| 08 | Bounded contextual targets | Complete: [current](transition-research/08-current.md) | Complete: [comparison](transition-research/08-comparison.md) | Complete: t08_implementation | One-way original-value target interactions; no duplicated penalty | 7 profile tests passed |
| 09 | Causal features, risks and faults | Complete: [current](transition-research/09-current.md) | Complete: [comparison](transition-research/09-comparison.md) | Complete: t09_implementation | Daily risks, fault explanations, status and severe-fault commercial refusal | 7 risk tests and commercial checks passed |
| 10 | Fermentation / extraction | Complete: [current](transition-research/10-current.md) | Complete: [comparison](transition-research/10-comparison.md) | Complete: t10_implementation (Terra, max) | Uniform daily engine; actual environment re-resolved on completion | 11 engine tests, 2 environment-handover tests passed |
| 11 | Maturation / vessels / bottle evolution | Complete: [current](transition-research/11-current.md) | Complete: [comparison](transition-research/11-comparison.md) | Complete: t11_implementation (Terra, max) | Capacity, wear, reuse, temperature, maturation, forecast and bottle development | 12 equipment/maturation tests and core scenarios passed |
| 12 | Sales / buyers / contracts | Complete: [current](transition-research/12-current.md) | Complete: [comparison](transition-research/12-comparison.md) | Complete: t12_implementation | Fixed NPC offers, live quotes, reservations, atomic delivery and receipts | 11 commercial tests; 4 cross-domain transaction tests passed |
## Dependency-aware slices and ownership

1. Research current architecture and reference source; define domain-owned lot, inventory, vineyard, vessel, work, finance and commercial contracts. Primary owns shared contracts and final integration.
2. Establish vineyard, origin and inherited anchor rules; preserve potential separately from mutable physical state. Inventory alone owns quantities and placement. Add current-state and cross-domain validation.
3. Implement sensory projection, generic moving-target evaluator, structural/taste target profiles and separate fault assessment. No score is a physical input or authoritative current state.
4. Implement one deterministic development entry point with canonical daily substeps: fermentation, finite extraction, environment-dependent maturation and risks. Existing lots develop before week-end harvest output. Bottling preserves history and development.
5. Implement capacity-safe transfers, splitting/blending of physical states, bottling snapshots, NPC sales and explicit contract obligations inside atomic company commands.
6. Connect estate, winery, cellar, company and management panels to read models and commands. Expose process options, blockers, assessments, history, forecast assumptions, reservations, sales and cash. No formulas in React or Pixi.
7. Integrate authority and retained browser intents for every new command; preserve unknown-outcome recovery and stale-revision rejection.
8. Verify deterministic domain scenarios and negative boundaries, authority/API/retry integration, complete browser production-to-sale flow, build/typecheck, visual desktop flow and diff/ownership review. Update owning working documents from verified code.

## Acceptance scenarios

- Empty company can buy/plant a vineyard, grow a crop and harvest it with partial progress and explicit capacity/work blockers.
- Origin Prestige affects commercial context without altering raw potential; site/grape/ripeness choices alter inherited anchors.
- Pressing balances yield, extracted material and exposure; fermentation consumes available sugar, produces alcohol, can stall and can be managed.
- Same inputs and stepping policy yield identical output; previews do not mutate state; no negative quantities or unbounded material creation.
- Steel/oak/concrete and poor/good storage produce causal differences; bottling preserves development and releases vessel capacity; bottled wine develops and eventually declines.
- Separate physical portions can be transferred/split/blended with lineage, capacity and material balance intact. Reserved/sold inventory cannot be consumed twice.
- Structural and taste evaluations share a framework, have bounded contextual targets and distinguish physical faults from imbalance.
- Cellar presents actual identity, quantity, current assessments, targets, tasting descriptors, maturity trajectory, interventions and history.
- Sales and contracts use authority-derived prices/eligibility, debit stock once and credit cash once; due obligations and reservations are deterministic.
- Reload preserves the current game; retries cannot repeat harvests, bottling or sales; stale commands cannot overwrite newer revisions.

## Verification log

The entries below are historical slice checkpoints. The final combined results and cleanup status are recorded in the continuation and handoff sections.

- Initial checkout: clean (`git status --short`, 21 November).
- Confirmed current source implements calendar only; current stack: React 19, PixiJS 8, TypeScript, Vite, Vitest and Playwright. No application claims inferred from 04.
- Commands selected from package manifest: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (focused selections before full integration).
- `npm ci` installed the pinned worktree dependencies (140 packages, zero reported audit vulnerabilities). This was necessary because `vitest` was initially unavailable; no manifest/lock change was requested.
- `npm test -- tests/game/vineyard-rules.test.ts`: 7 tests passed. This is domain evidence, not integrated loop verification.
- `npm test -- tests/game/vineyard-rules.test.ts tests/game/origin.test.ts`: 12 tests passed after consolidating physical-site suitability. Domain evidence only.
- Topic02 agent: `npm test -- tests/game/wine-operations.test.ts`: 9 tests passed. Primary inspected APIs, normalized bottling scores, signed-safe vintage handling and amount/placement separation.
- Topic04 agent: `npm test -- tests/game/sensory.test.ts`: 5 tests passed (projection only; UI remains in progress).
- `npm test -- tests/client/CompanyClient.test.ts`: 13 tests passed including exact wine-sale recovery and authoritative rejection text. An initial run hit the unfinished development module through a barrel import; direct contract imports removed that unnecessary dependency.
- Topic05 agent: `npm test -- tests/game/moving-targets.test.ts`: 7 tests passed.
- Topic04 UI agent: 3 interaction tests passed with mocked query boundaries. No browser rendering proof yet.
- `npm test -- tests/game/current-state-validation.test.ts`: 4 tests passed (schema, provenance, allocation and financial invariants).
- `npm test -- tests/game/command-boundary.test.ts`: 9 tests passed (runtime payload validation and independent copies).
- `npm test -- tests/game/harvest-work.test.ts`: 5 tests passed (fair work, stable priorities, feasible XP and blockers).
- Root corrected strict TS narrowing in Operations.ts; dedicated temporary-config `tsc` passed and 9 operation tests passed again. The installed TypeScript7 package does not expose the old compiler API; direct `.bin/tsc.cmd --project` works for scoped checks.
- Supabase and Postgres skills loaded for persistence verification; changelog reviewed. Local PostgreSQL18 binaries are available for disposable integration tests; no cluster started and no remote changes made.
- Topic06 agent: `npm test -- tests/game/taste.test.ts`: 4 tests passed; scoped TypeScript passed.
- `npm test -- tests/game/inventory.test.ts`: 3 tests passed for reservations, explicit blending/placement and quantity consumption.
- Current-state validation passed again after archive lineage/source invariants and one coherent lot per vessel were added (4 tests). No broad suite/build has run yet.
- Blend source ordering/ties are now stable and blends receive their own wine identity; 10 operation tests passed. Harvest history records ripeness/noble/grey rot and the estate displays both rot pressures.
- Topic08 resumed and completed: 7 target-profile tests and scoped TypeScript passed. Explicit unreserved material discard was added to prevent failed lots or bottling remainders from trapping storage; integrated tests remain pending.

## Continuation record

22 November: user requested continuation after the provider usage reset. All 24 research reports were read and all 36 required topic agents have now run: current-research, comparison-research and implementation for each topic 01 through 12. The main orchestration integrated their modules and supporting domain rules. Terra max was selected for the cross-cutting UI, physical engine and vessel/maturation work; other topic agents used the requested Luna max default. No token budget was imposed; the runtime determines available context.

Current phase: local implementation and verification complete. All required module imports resolve. Final broad Vitest gate passed 31 files / 273 tests with both PostgreSQL suites enabled. Full production typecheck/build passed; additional strict unused-local/parameter check passed after removing one unused test fixture. All 12 Playwright tests passed together in 32.2 seconds with one worker. The real PostgreSQL browser flow creates a vineyard, grows/harvests 200 kg, presses/ferments, bottles 100, sells 20, reloads 80 and fulfills a 24-bottle merchant contract. Browser assertions verify stock, two sales, one fulfilled commitment, cleared reservations and retained bottling snapshot. Desktop 1280×720 and narrow 390×844 cellar screenshots were inspected; narrow viewport has no horizontal overflow. Numerical balance and final UI polish remain provisional.

Independent reviews were completed for wine/equipment/assessment and authority/client/UI/action integration. Corrected findings: no multiplied inherited history when split siblings are reblended; generated rain can stop harvest; one-week calendars use the planned crop year; physical bottling readiness is labeled accurately; sale relationship credit scales with volume and contract goodwill applies once; severe physical faults refuse both direct sale and delivery; unused capacity from blocked/capped harvest activities is redistributed while preserving even staff sharing. Unreadable retained intents remain protected and the company read-only, but independent server recovery and a copy/preserved-exit path prevent trapping the player in that company. Focused work 12 and client 22 tests passed and the final broad suite includes them.

Browser debugging separated test defects from game defects: select controls now use their combobox roles, profile creation waits for the newly mounted company screen before filling it, and the unreadable-record disclosure uses an exact text selector. Earlier browser runs were disturbed by concurrent source edits and an environment-file restart; the final gate ran after source stabilization. Playwright now uses one worker consistently. Vite's production build retains a large-main-chunk warning; code splitting is a future performance improvement, not a failed build.

A disposable PostgreSQL 16 cluster on loopback 55439 was used for adapter, HTTP, browser and setup verification. The installed 18 binaries lacked their share files, so 16 was selected. The current reset schema now executes inside BEGIN/COMMIT and was applied successfully to a fourth fresh setup database with local NOLOGIN anon/authenticated roles present. No application data or remote service was accessed. Cleanup and the manual setup verification results are recorded below.

Supabase boundary added by the user: prepare SQL and configuration locally; application to Supabase is manual, and agent access to Supabase is prohibited. The ignored worktree environment was prepared from only the server configuration keys in the user-authorized main-checkout secrets file. Offline checks confirmed a parsed database URL, no URL SSL overrides and an existing unexpired CA certificate. No secret values were displayed or committed, and no remote connections were made. The [manual setup guide](../docs/WorkingDocs/Supabase_Core_Game_Setup.md), [transactional reset SQL](../src/server/postgres/schema.sql) and [read-only verifier](../src/server/postgres/verify-setup.sql) are ready. The verifier was executed in read-only local transactions: installed schema with client roles (25 rows, PASS plus the explicit MANUAL setting), missing schema (actionable diagnostics), and stock PostgreSQL without client roles (four ROLE_NOT_PRESENT results). An initial index-join fan-out was corrected and all three cases passed afterward. No Supabase query or write was performed.

No commits, merges, publication, older-save compatibility code, or remote changes were made. Full supporting recruitment/research/lending/building/shared-market/progression systems remain outside the authorized core scope. The twelve topic implementations, 24 research reports and original 36 topic agents are complete.

## Final handoff and cleanup

All twelve topics have researched, implemented, integrated and tested outcomes, with the live UI connected to the company authority. The minimum supporting work, equipment, inventory, finance and NPC commercial rules are implemented; the broader migration inventory remains out of scope. Source and docs were reviewed for misplaced ownership, stale imports, hardcoded duplicate rules, placeholders, links, whitespace and conflict markers. Strict unused-local/parameter TypeScript checks passed. The 24 research reports remain under [transition-research](transition-research/).

The current worktree server environment is ignored by Git, was checked offline, and its server configuration values are absent from the production browser bundle. The operator must manually apply the current reset SQL in the intended disposable pre-release Supabase project, run the read-only verifier and Dashboard exposed-schema check, then start the authority/UI and create a new company. Resetting deletes old Winemaker05 development records; it is not a save migration. Remote connectivity, schema installation and deployment remain unverified by explicit user restriction.

The owned test authority/Vite processes exited, and the disposable PostgreSQL 16 server was stopped. Loopback ports 4173, 55439 and 55440 are no longer listening. Automatic approval review rejected recursive removal of the disposable temporary database directory with only a blocked-by-policy reason. Its stopped files and path pointer remain under the operating-system temporary directory; no cleanup retry or remote action was used to bypass that rejection. The separate temporary recovery browser configuration was removed safely. No commits or publication were made.
