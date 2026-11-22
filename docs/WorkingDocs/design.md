# Design

Record approved product direction and user-facing decisions here; identify proposals and open questions separately. The [transition overview](Winemaker04_to_05_Transition_Overview.md) contains the Winemaker04 findings, discussion rationale, and detailed retain/rebuild/reconsider table. The agreements below are design direction, not an implementation specification. Record verified behavior in [application-flow.md](application-flow.md).

## Agreed direction

- **Player and company identity:** start with a player name and no email or password, or enter a company name without creating a user. Store selectable player profiles in the database, keep the last selection in the browser, and allow multiple named companies per player. Profile IDs, rather than Supabase Auth identities, own these 04-style local profiles and companies. Following the 04 flow, companies created without a user are shared as unassigned companies and can be selected from another browser. These no-password profiles and unassigned companies intentionally use 04's shared access model.

- **Preserve the connected wine flow:** vineyard and harvest establish potential; anchors shape later wine development; structural characteristics and taste express the evolving wine; processing continues through maturation and bottle aging; the cellar connects development to commercial management.
- **Separate vineyard potential from origin prestige:** replace the single Land Value Modifier concept with **Terroir Potential** for agricultural/raw-material contribution and **Origin Prestige** for commercial reputation. These are the agreed working player-facing terms; formulas and their interactions with existing company and vineyard prestige remain open.
- **Separate inherited potential from mutable development:** retain the concept of **Raw Material Anchors** and distinguish it from processing/development state. The mutable side may be called Processing Anchors or Development State; its final name and representation remain open.
- **Keep contextual moving-target evaluation:** retain moving targets for structural evaluation and a parallel taste system using the same configurable evaluation framework. The profiles may have different dimensions, targets, weights, and scoring roles.
- **Design a genuine wine-development engine:** fermentation, extraction, maturation, storage conditions, and vessel attributes should cause time-dependent changes in the wine. Development continues after bottling. Useful feature and risk scenarios should connect to those causes rather than operate only as separate stat modifiers.
- **Rethink lifecycle persistence:** do not carry Winemaker04's four persisted states into 05 unchanged. Persist material form, active processes, physical facts, placement and relevant history; derive readiness or maturation labels where possible and store an explicit status when it represents a durable fact.
- **Make the cellar the central management experience:** retain the Pinot Noir · 2029 wine-detail example. Connect wine identity, development, maturity, inventory, release choices, and commercial decisions in the cellar. Preserve the broadly successful sales, pricing, customer, and contract systems while redesigning how they connect to the wine.
- **Reduce duplicated structural adjustments:** let moving targets handle most structural synergies and penalties, while keeping physical faults distinct. Which exceptional rules remain is open.

## Agreed presentation direction

- Use a **2.5D world view organized into scenes**, supported by detailed panels for management and analysis. Alpha visuals may use placeholders.
- Keep the cellar as the central wine-management experience. Primary navigation is Estate, Winery, Cellar, Company, and Management; Management groups Finance, Contracts/Market, Equipment, and People/Work, with contextual links into individual panels.
- Use scene-specific camera compositions with shared selection and panel conventions. Scene objects and lists may open placeholder details; do not use drag-and-drop for the alpha.
- Keep a hideable Activity Manager in the main shell, as a sidebar or overlay. Its visibility is temporary and does not persist.
- Show a calendar and an Advance Time button in the top bar. Time advancement and alerts are outside this UI design and are handed to implementation planning.
- Make Company more dashboard-like than Winemaker04. High-score/achievement sections and statue or landmark imagery may inspire placeholder modules, without adopting 04 scoring or progression rules.
- Wine-detail modals may take visual and interaction inspiration from Winemaker04, adapted to 05 concepts.
- The alpha requires navigation and placeholders, not game data, fixture-driven simulation behavior, or persisted player preferences. The prototype starts at Estate by default; the Cellar stays directly reachable from global navigation.
- Target desktop landscape first, using about 1280×720 as the alpha layout baseline; mobile is deferred.
- Detailed scene layouts, camera framing, panel sizing, and Management sub-navigation remain to be designed.
- The intended alpha stack is TypeScript, Vite, and React for the application shell, with PixiJS for layered, fixed-composition 2.5D scenes. The design does not require a freely rotating 3D camera or dynamic lighting. Pin the PixiJS version when the application is scaffolded.

See the [Alpha UI Design Plan](plans/2026-11-13-alpha-ui-design-plan.md) for the approved placeholder-prototype scope, scene map, navigation walkthroughs, and acceptance criteria. The [UI visual concepts](Winemaker05_UI_Visual_Concepts.md) hold the full brainstorm and generated image references.

## Agreed supporting-system migration direction

The [supporting-system migration research](Winemaker04_to_05_System_Migration_Research.md) is the authorized inventory and migration direction. Its subsystem dispositions identify where to adapt Winemaker04, compare another game, rewrite, avoid an old implementation, or defer a product decision. The 15 November decisions below supersede earlier open-status labels where they overlap; other dependencies remain open. Approval does not select exact formulas, copied code or content, or a delivery schedule.

- **Calendar and company foundation:** retain a game calendar and company-scoped progress. Redesign tick coordination, state ownership and save boundaries. Review 04 starting scenarios, founders and related authored content for 05 rather than assuming every field or value carries over.
- **Finance and lending:** retain financial management, transactions, lending, credit and recovery as supporting systems. Redesign asset valuation and loan accounting for 05, comparing the ledger, lender and credit implementations in Industri Clicker and SkiClicker with 04's winery-specific needs. Investigate the research document's source-level accounting and credit risks before reuse. A player-level wallet is deferred; the depth of individual finance mechanics remains open.
- **People, teams and activities:** adapt 04's individual staff, recruitment, wages, teams, work allocation and learning through applied work. Redesign activity handlers around 05 domain rules. Compare Industri Clicker's explicit training with 04's experience model; whether to add a separate training activity remains open.
- **Research, grants and gates:** retain 04's work-driven research projects, funding and progression concepts as the starting point for 05 design. Compare Industri Clicker's typed projects, gates and action grants and VisualIdle's catalog validation. Redesign enforcement at domain boundaries and guard completion and rewards against repetition. The research interface, specific unlocks and the roles of grants and permanent effects remain open.
- **Land and weather:** adapt useful 04 land, vineyard and site-aware weather mechanics, including forecasts and effects on vineyard conditions, planting, harvesting and grape markets. Reconcile their rules with the 05 vineyard, time and wine-development models.
- **Inventory, vessels and facilities:** redesign inventory and lot ownership for 05. Adapt useful 04 vessel ownership, allocation, maintenance and market concepts, and connect vessel and storage conditions to the redesigned wine-development engine. Design general buildings and storage facilities for 05; do not treat 04's incomplete building handlers or unconnected vessel-effect calculations as finished features.
- **Markets and commercial relationships:** adapt 04's shared buy-market concepts, local suppliers, seasonal buyers, bulk sales, customer relationships, wine orders, contracts, forward contracts and cooperative options to 05 goods and commercial rules. Compare TraderGame01 for direct company-to-company settlement and other games for pricing and simulated supply. Distinguish 04's upfront market-custody sales from direct peer-to-peer settlement; design shared-market authority, timing and transaction safety explicitly.
- **Prestige, achievements and records:** adapt useful company, vineyard and cellar prestige, achievement, production-history and notification concepts to 05 events and lots. Compare Industri Clicker's event and achievement handling; redesign time-driven decay and prevent duplicate rewards. Decide the relationship among Origin Prestige, vineyard reputation and company prestige.
- **Persistence and support:** preserve company save/load needs while designing explicit failure handling and evaluating 04 Supabase records, VisualIdle snapshots and Industri Clicker's company saves. Retain useful player reference, preference and development-tooling concepts where they fit. The account, authority, offline, notification and leaderboard directions agreed on 15 November are recorded below.
- **Do not carry inactive or obsolete implementations forward as completed systems:** 04's dormant board/share facade, incomplete handlers, old UI, schemas and compatibility wrappers are not 05 features by default. A future full ownership/share system is a separate decision.

## Agreed architecture and product decisions — 15 November 2026

The user accepted all 43 numbered recommendations from the architecture discussion. The mapping below preserves their numbers and qualifications. These are design directions, not implemented behavior. They supersede conflicting open-status labels in earlier research and the [technical architecture proposal](Winemaker05_Technical_Architecture_Proposal.md); other unresolved details remain open. The [UI alpha](plans/2026-11-13-alpha-ui-design-plan.md) remains a navigation and placeholder prototype, without game data or persistence.

### Code and orchestration

1. Separate application, game-domain, persistence, React UI and Pixi scene layers; domain rules do not depend on presentation, database or browser APIs.
2. Give each company one logical authoritative state composed of domain-owned sections, without requiring one giant class or table.
3. Use one company command coordinator to order and commit changes; domains own their calculations and validation.
4. Change gameplay through explicit commands; UI and scenes read queries and send commands rather than modifying game state directly.

### Authority, accounts and persistence

5. Start the connected playable game with server-authoritative company simulation: trusted server code runs actions and commits results.
6. Use Supabase/Postgres as the starting **candidate**, with TypeScript game rules in a trusted command service and database transactions for commits. This does not select an installed provider or import 04's schema.
7. Keep player identity separate from company state and allow multiple companies per player. The later 04-style database profile direction above supersedes the requirement for account-backed player identity.
8. Start online; defer offline gameplay and synchronization. The UI-only prototype is unaffected.
9. Store a current company snapshot atomically and keyed by company. Add separate tables when shared trading, queries or performance require them, while retaining coherent company commits. The 17 November decision below removes save-version handling.
10. Commit each accepted gameplay command before showing success; keep rendering responsive and show pending state. Any later less-frequent-save policy must explicitly define its loss window.
11. Use company revisions to reject stale writes and reload rather than overwrite a newer session.
12. Give commands stable IDs and retain receipts for the supported retry period so lost responses and repeated commands do not apply an action twice.
13. Distinguish missing, invalid and unavailable saves; preserve invalid data during normal operation. Resolve in-flight commands before switching companies and ignore late old-company responses.
14. Use the current 05 save schema. The 17 November decision below replaces the earlier direction to add save migrations when needed.

**17 November 2026 — pre-release compatibility decision:** Winemaker05 is not live. Do not add application or save-version checks, backward-compatibility paths, legacy-data support or migrations to preserve older versions or saves. Change the current schema and its callers directly; obsolete development saves can be discarded and the current schema recreated. Continue to validate current data and use company revisions for concurrency: those are correctness safeguards, not save-version compatibility.

### Time and the tick

15. Start with manual advancement, one game week per action. Automatic progression and fast-forwarding can later use the same command.
16. Model weeks, seasons and years explicitly with central boundary calculation; weeks per season and starting date remain configurable and undecided.
17. Order the tick: plan interval and weather; update vineyard conditions; calculate staff work; develop existing wine lots; apply work outcomes including partial harvest; process due finance and contracts; apply progression, prestige and required history; validate and commit date and state.
18. Initially apply work completions and partial-harvest output at week end. Newly created lots begin developing in the next interval. Add mid-week event boundaries where needed.
19. Initially use daily internal wine-development steps within a weekly advance; validate the step size against the wine model before treating it as final.
20. Run state-changing phases in a defined order; parallelize only when independence and deterministic combination are demonstrated.
21. Use explicit reproducible random contexts; forecasts use copies or scenario seeds without consuming live random progression or presenting hidden outcomes as certain.

### Work, resources and money

22. Allow staff to work on multiple activities, initially splitting available work evenly and showing contributions in previews. Player-set staff-work allocation can be added if needed.
23. Allow partial work and harvests; apply only feasible work, award experience only for work applied, and show blocking or slowing reasons.
24. Resolve contested staff, vessels, material and cash using explicit stable rules. Start with player-set activity priority and a stable tie-breaker; this handles contested claims while staff time remains evenly split under decision 22.
25. Initially process mandatory obligations in order: wages, loan payments, then contract obligations. Record applicable missed-payment consequences; do not borrow automatically without separate approval.

### Wine, lots and evaluation

26. Wine owns physical lot composition and development; inventory owns quantity, location, custody and allocations; equipment owns vessel properties and condition.
27. Portions in different vessel or storage conditions develop as separate lots with shared lineage. The cellar can group them by wine, label or vintage. Allow splitting, transfers and blending subject to capacity and material balance; exact units and interaction rules remain to be designed.
28. Use one wine-development entry point for fermentation, extraction, maturation, risks and bottle evolution, returning one consolidated result per lot. Start with explicit ordered calculations and refine the solver if needed.
29. Retain inherited raw-material potential as a harvest baseline; track remaining availability, degradation, exposure and process progress as mutable development state. Exact fields and equations remain open.
30. Persist material form, active processes, physical facts, placement and relevant history; derive readiness and maturation labels where possible. Store a status explicitly when it represents a durable fact.
31. Derive current sensory profiles and assessments from current wine state using the agreed moving-target framework. Preserve meaningful historical assessments, such as at bottling, while current assessments change.

### Events, records and shared trading

32. Use state transitions with explicit domain events, not event sourcing as the foundation. Persist gameplay and historical records such as financial postings, production history and completed achievements; derive current summaries.
33. Separate gameplay events, notification history, toast policy and presentation. Plan durable company notification history and account/company read state; keep local presentation preferences separate from game state. None is required for UI alpha.
34. Support an asynchronous shared market alongside local and NPC systems. Start with 04's market-custody model as the **comparison**: the seller receives upfront settlement and the market holds goods. Defer direct player-to-player settlement until its distinct rules are designed.
35. Use trusted server market authority and a server-owned market clock for listing expiry and market-side development; companies can advance winery calendars independently. The relation between real time and market time remains to be balanced.
36. Validate listing, price, inventory, capacity, payment and ownership at the authority. Commit listing and company changes atomically where possible; otherwise design explicit reservation, settlement, recovery and deduplication.
37. Keep leaderboard submissions and other external effects outside simulation calculations. Where reliable delivery is required, save an outbox record with the transaction and deliver using a stable ID. Defer online leaderboards until fairness and trust are designed.

### Related product directions

38. Design the smallest useful raw-potential and physical-variable set for meaningful wine development; 04 fields are candidates, not a fixed taxonomy. Exact variables, equations and fidelity remain open.
39. Keep structural balance, taste fit, style, typicity and faults distinguishable. Their overall-score contributions remain open; commercial success should not require all wines to follow one universal profile.
40. Keep Terroir Potential agricultural and Origin Prestige commercial. Their relationship to vineyard reputation, company prestige and brands remains to be designed.
41. Retain company finance, lending and useful founder arrangements. Defer a separate player wallet, dividends and a full public-company/share system until their gameplay purpose is clear.
42. Retain staff-driven research and learning through work. Design the research interface and unlocks separately; one-use grants and a separate staff-training activity remain optional.
43. Select 04 grapes, regions, starting scenarios, buildings and other authored content individually after the 05 mechanics exist. Continue the approved UI prototype with placeholders while detailed cellar and management interactions are designed.

## Core-game implementation authorization, 21–22 November 2026

The user requested implementation of the transition overview's twelve comparison topics, with research of current05/04 and other games before coding each topic. The authorized outcome is a connected playable company loop from vineyard establishment, land value and harvest through winery processing, maturation, bottling, assessment, sales and wine contracts, with working UI. The broader supporting-system migration inventory remains outside this task; only the work, inventory, vessels, cash and NPC commercial support required for this loop is included.

The implementation follows the ownership, deterministic tick, daily development and authority decisions above. Current anchor fields, sensory/taste mappings, contextual target rules, scoring and process/economic coefficients are provisional implementation choices within that authorization. They are documented from source in [application flow](application-flow.md) and the [relationship map](VariableRelationshipMap.md), and do not establish final balance approval. The [implementation plan](../../plans/2026-11-21-core-game-transition.md) records the twelve research/coding streams, review findings and verification evidence.

On 22 November the user also requested completion of PostgreSQL/Supabase setup, supplying a local secrets file for configuration and explicitly reserving Supabase access and SQL application for manual work. Prepare and verify the current-schema SQL locally and provide a manual setup guide; do not connect an agent to Supabase for this task.

## Remaining open decisions and proposals

- The exact anchor fields and counts, mutable-state vocabulary, six-characteristic starting set, and taste-family/descriptor taxonomy. The 12 anchors, six characteristics, 14 taste families, and 26 descriptors in Winemaker04 are references, not fixed 05 requirements.
- The detailed wine/lot schema, exact persisted facts, process statuses and readiness and maturity rules within the agreed ownership and lifecycle direction.
- The physical variables, equations, numerical accuracy and realism of wine development. The initial daily substep remains subject to validation.
- The exact target-shifting rules and scoring formula, including the future role or weight of Taste Quality Index and the relationship between quality, style, and typicity.
- The cellar's detailed management presentation, available operations, blending and lot-splitting rules, and final interaction design within the agreed separate-lot and shared-lineage model.
- How Origin Prestige relates to evolving vineyard reputation, company prestige, brands, buyers, and contracts.
- Calendar values and pacing, the relationship between real time and server market time, and detailed shared-market pricing, custody and settlement rules.
- Confirming the backend candidate and exact service/storage implementation; offline synchronization and leaderboard design remain deferred. Account, authority and notification directions are recorded above.
- The desired depth of finance and founder arrangements; the deferred player wallet; optional explicit training and scheduling; and which activities require people.
- The role and presentation of research, grants and permanent effects; which capabilities they gate and how their outcomes interact with other domains.
- Which product categories, facilities, buildings, 04 scenarios and authored catalogs to include, and whether to add market diffusion, resource substitution or full public-company/share gameplay.

Keep these open items distinct from the agreed direction above. The transition overview records the detailed rationale and remaining design questions; update this document when the user confirms further decisions.

Further detailed scene and panel layouts and art direction remain open in [Winemaker05 UI and Visual Concepts](Winemaker05_UI_Visual_Concepts.md) and the [Alpha UI Design Plan](plans/2026-11-13-alpha-ui-design-plan.md); their images do not define implementation details. The selected PixiJS version is recorded in [project information](PROJECT_INFO.md).
