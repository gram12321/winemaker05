# Design

Record approved product direction and user-facing decisions here; identify proposals and open questions separately. The [transition overview](Winemaker04_to_05_Transition_Overview.md) contains the Winemaker04 findings, discussion rationale, and detailed retain/rebuild/reconsider table. The agreements below are design direction, not an implementation specification. Record verified behavior in [application-flow.md](application-flow.md).

## Agreed direction

- **Preserve the connected wine flow:** vineyard and harvest establish potential; anchors shape later wine development; structural characteristics and taste express the evolving wine; processing continues through maturation and bottle aging; the cellar connects development to commercial management.
- **Separate vineyard potential from origin prestige:** replace the single Land Value Modifier concept with **Terroir Potential** for agricultural/raw-material contribution and **Origin Prestige** for commercial reputation. These are the agreed working player-facing terms; formulas and their interactions with existing company and vineyard prestige remain open.
- **Separate inherited potential from mutable development:** retain the concept of **Raw Material Anchors** and distinguish it from processing/development state. The mutable side may be called Processing Anchors or Development State; its final name and representation remain open.
- **Keep contextual moving-target evaluation:** retain moving targets for structural evaluation and a parallel taste system using the same configurable evaluation framework. The profiles may have different dimensions, targets, weights, and scoring roles.
- **Design a genuine wine-development engine:** fermentation, extraction, maturation, storage conditions, and vessel attributes should cause time-dependent changes in the wine. Development continues after bottling. Useful feature and risk scenarios should connect to those causes rather than operate only as separate stat modifiers.
- **Rethink lifecycle persistence:** do not carry Winemaker04's four persisted states into 05 unchanged. Consider material form, active processes, physical facts and history, and derived readiness separately; whether a maturing/aging state is stored or calculated remains open.
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

The [supporting-system migration research](Winemaker04_to_05_System_Migration_Research.md) is the authorized inventory and migration direction. Its subsystem dispositions identify where to adapt Winemaker04, compare another game, rewrite, avoid an old implementation, or defer a product decision. The inventory's stated dependencies and deferred decisions remain open. Approval establishes direction, not exact formulas, copied code or content, a save provider, a market authority, or a delivery schedule.

- **Calendar and company foundation:** retain a game calendar and company-scoped progress. Redesign tick coordination, state ownership and save boundaries. Review 04 starting scenarios, founders and related authored content for 05 rather than assuming every field or value carries over.
- **Finance and lending:** retain financial management, transactions, lending, credit and recovery as supporting systems. Redesign asset valuation and loan accounting for 05, comparing the ledger, lender and credit implementations in Industri Clicker and SkiClicker with 04's winery-specific needs. Investigate the research document's source-level accounting and credit risks before reuse. A player-level wallet and the desired depth of individual finance mechanics remain open.
- **People, teams and activities:** adapt 04's individual staff, recruitment, wages, teams, work allocation and learning through applied work. Redesign activity handlers around 05 domain rules. Compare Industri Clicker's explicit training with 04's experience model; whether to add a separate training activity remains open.
- **Research, grants and gates:** retain 04's work-driven research projects, funding and progression concepts as the starting point for 05 design. Compare Industri Clicker's typed projects, gates and action grants and VisualIdle's catalog validation. Redesign enforcement at domain boundaries and guard completion and rewards against repetition. The research interface, specific unlocks and the roles of grants and permanent effects remain open.
- **Land and weather:** adapt useful 04 land, vineyard and site-aware weather mechanics, including forecasts and effects on vineyard conditions, planting, harvesting and grape markets. Reconcile their rules with the 05 vineyard, time and wine-development models.
- **Inventory, vessels and facilities:** redesign inventory and lot ownership for 05. Adapt useful 04 vessel ownership, allocation, maintenance and market concepts, and connect vessel and storage conditions to the redesigned wine-development engine. Design general buildings and storage facilities for 05; do not treat 04's incomplete building handlers or unconnected vessel-effect calculations as finished features.
- **Markets and commercial relationships:** adapt 04's shared buy-market concepts, local suppliers, seasonal buyers, bulk sales, customer relationships, wine orders, contracts, forward contracts and cooperative options to 05 goods and commercial rules. Compare TraderGame01 for direct company-to-company settlement and other games for pricing and simulated supply. Distinguish 04's upfront market-custody sales from direct peer-to-peer settlement; design shared-market authority, timing and transaction safety explicitly.
- **Prestige, achievements and records:** adapt useful company, vineyard and cellar prestige, achievement, production-history and notification concepts to 05 events and lots. Compare Industri Clicker's event and achievement handling; redesign time-driven decay and prevent duplicate rewards. Decide the relationship among Origin Prestige, vineyard reputation and company prestige.
- **Persistence and support:** preserve company save/load needs while designing explicit failure handling and evaluating 04 Supabase records, VisualIdle snapshots and Industri Clicker's company saves. Retain useful player reference, preference and development-tooling concepts where they fit. Accounts, offline play, cloud synchronization, leaderboards and notification read-state persistence remain open.
- **Do not carry inactive or obsolete implementations forward as completed systems:** 04's dormant board/share facade, incomplete handlers, old UI, schemas and compatibility wrappers are not 05 features by default. A future full ownership/share system is a separate decision.

## Open decisions and proposals

- The exact anchor fields and counts, mutable-state vocabulary, six-characteristic starting set, and taste-family/descriptor taxonomy. The 12 anchors, six characteristics, 14 taste families, and 26 descriptors in Winemaker04 are references, not fixed 05 requirements.
- The authoritative wine/lot model, which facts and processes are persisted, and which readiness or maturity statuses are derived.
- The physical variables, process order, equations, time step, randomness, and level of realism for fermentation, extraction, maturation, vessel/storage effects, faults, and bottle evolution.
- The exact target-shifting rules and scoring formula, including the future role or weight of Taste Quality Index and the relationship between quality, style, and typicity.
- The cellar's management unit, available operations, blending and lot-splitting rules, and final interaction design.
- How Origin Prestige relates to evolving vineyard reputation, company prestige, brands, buyers, and contracts.
- The time model and pacing; how independently advancing companies interact with shared-market time, ownership, pricing, settlement and concurrency.
- The 05 save provider and authority model; whether accounts, local/offline play, cloud synchronization, leaderboards and durable notification read state are needed.
- The desired depth of finance, founder arrangements and a player wallet; explicit staff training and scheduling; and which activities require people.
- The role and presentation of research, grants and permanent effects; which capabilities they gate and how their outcomes interact with other domains.
- Which product categories, facilities, buildings, 04 scenarios and authored catalogs to include, and whether to add market diffusion, resource substitution or full public-company/share gameplay.

Keep these open items distinct from the agreed direction above. The transition overview records the detailed rationale and remaining design questions; update this document when the user confirms further decisions.

The detailed scene and panel layouts, specific art direction, and PixiJS version remain open in [Winemaker05 UI and Visual Concepts](Winemaker05_UI_Visual_Concepts.md) and the [Alpha UI Design Plan](plans/2026-11-13-alpha-ui-design-plan.md); their images do not define implementation details.
