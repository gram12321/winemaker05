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

## Agreed supporting-system direction

The [Winemaker04-to-05 system inventory](Winemaker04_to_05_System_Inventory.md) records the detailed 04 subsystem audit, sibling-game comparisons, and proposed responsibility seams. The following migration directions are agreed; they preserve player needs and authored content without requiring a 1:1 code or data-model port.

- Keep the in-game calendar and player-driven game tick. Winemaker05 will not use a server tick; revisit the orchestration and domain boundaries.
- Carry Winemaker04 starting scenarios, initial characters and teams, and story content as authored content, mapping fields to 05 and adjusting only where 05 requires it.
- Keep and refine land and vineyard systems. Keep useful weather ideas and crop/harvest connections while reviewing the effects and redesigning the presentation.
- Keep most staff-driven activity behavior. Keep staff training within staff progression and work experience.
- Treat finance, company value and statements, lenders, credit rating, and loans as one finance package, using 04 as the richest winery-specific baseline and comparing narrower sibling implementations for useful patterns.
- Keep 04 prestige as the baseline and compare selected sibling refinements. Retain useful achievements, production history, and notification behavior; base achievement checks on 05 events, production records on the 05 lot and maturity model, and notifications on dated game events.
- Do not assume a separate research tree or shared grant, gate, and permanent-effect system. Reassign useful pieces to the 05 domains that own the changed behavior after the wine loop and progression are defined.
- Preserve the useful NPC, local, and company-to-company market choices and expand product coverage after 05 inventory and trading rules are defined. Keep the ability to save company progress; the provider and schema remain open.

These directions do not choose a UI framework, save provider, implementation model, formulas, or shared market authority.

## Open decisions and proposals

- The exact anchor fields and counts, mutable-state vocabulary, six-characteristic starting set, and taste-family/descriptor taxonomy. The 12 anchors, six characteristics, 14 taste families, and 26 descriptors in Winemaker04 are references, not fixed 05 requirements.
- The authoritative wine/lot model, which facts and processes are persisted, and which readiness or maturity statuses are derived.
- The physical variables, process order, equations, time step, randomness, and level of realism for fermentation, extraction, maturation, vessel/storage effects, faults, and bottle evolution.
- The exact target-shifting rules and scoring formula, including the future role or weight of Taste Quality Index and the relationship between quality, style, and typicity.
- The cellar's management unit, available operations, blending and lot-splitting rules, and final interaction design.
- How Origin Prestige relates to evolving vineyard reputation, company prestige, brands, buyers, and contracts.

Keep these open items distinct from the agreed direction above. The transition overview records the detailed rationale and remaining design questions; update this document when the user confirms further decisions.

The detailed scene and panel layouts, specific art direction, and PixiJS version remain open in [Winemaker05 UI and Visual Concepts](Winemaker05_UI_Visual_Concepts.md) and the [Alpha UI Design Plan](plans/2026-11-13-alpha-ui-design-plan.md); their images do not define implementation details.
