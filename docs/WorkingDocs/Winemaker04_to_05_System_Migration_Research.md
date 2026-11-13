# Winemaker04 to Winemaker05: supporting-system migration research

**Status:** Authorized supporting-system inventory and migration direction, approved 13 November 2026. The [design](design.md) records the agreed direction; items explicitly marked **Decide / defer** and other stated dependencies remain open.

**Companion:** [Simulation redesign overview](Winemaker04_to_05_Transition_Overview.md), which covers the central wine loop and separately identifies established direction.

**Scope:** An inventory of 04's game, management, online, and supporting systems, with comparisons to other games and candidate sources for 05. The inventory includes incomplete and inactive systems so they are not mistaken for missing audit coverage.

## How to use this inventory

Each disposition is an approved migration direction for 05 at the level described below. It does not select exact formulas, copy code, UI, save data or content unchanged, or resolve the questions explicitly left open:

| Label | Meaning |
|---|---|
| **Migrate 04** | 04 has a comparatively suitable concept or authored content; adapt its implementation and mappings to 05. |
| **Update from another game** | Start the comparison with the named sibling implementation, incorporating relevant 04 gameplay; the exact integration remains to be designed. |
| **Rewrite** | Retain the identified player need, but design the behavior or implementation around 05; 04 and siblings supply references. |
| **Do not migrate** | The identified old implementation, obsolete representation, or inactive stub should not be carried forward as working functionality. This does not prohibit a new design for its underlying idea. |
| **Decide / defer** | The product need or authority model is open. No positive migration recommendation is assumed. |

**Implemented** means the source has an identifiable runtime path, not that every path was executed or verified. **Partial** identifies missing, limited, or unevenly enforced behavior. **Inactive** and **configured only** are explicitly distinguished. Evidence links point to the inspected revision; a linked file demonstrates the cited subsystem, not an assurance that every rule in it is correct.

The current evidence supports rejecting certain old implementations and inactive stubs; it does not justify discarding an entire functioning supporting system solely because it exists in 04. Decisions about optional gameplay remain visible as **Decide / defer**.

### Most consequential findings

1. Most requested supporting mechanics exist in 04, but they are not equally complete. Staff *learn from work*; a standalone staff-training activity was not found. General building construction has a TODO completion handler. Vessel contact/expression calculations exist but were not found connected to wine development. [W9] [W30] [W53]
2. Research is a real staff-work project system with prerequisites, grant rewards, unlocks and four types of permanent effects. Enforcement varies: vineyard-cap and some commercial checks have domain consumers; grape/fermentation selections have UI checks, and a staff-limit enforcement path was not found. It deserves its own 05 decision rather than being silently removed. [W12] [W13] [W14] [W20]
3. 04's shared company-origin listings pay the seller up front and use market custody. That is not the same settlement model as a direct buyer-to-seller trade. TraderGame01 implements a richer direct transaction and is a useful comparison, with important atomicity caveats. [W24] [T1]
4. Industri Clicker is a strong candidate for comparing finance, explicit training, research/grants, market simulation, and persistence boundaries. SkiClicker supplies a further lending comparison, and VisualIdle provides research-catalog validation and save validation. Each has different game assumptions and limitations. [I1] [I2] [I3] [S1] [V1] [V2]
5. Source inspection found risks in 04 finance, research completion, and a global grape purchase constraint. These are design and verification warnings; they were not reproduced in a running game or database. Details and evidence are below.
6. Winemaker05 has no application source, configured test suite, or persistence provider yet. Its intended alpha UI stack is TypeScript, Vite, React, and PixiJS; this audit does not choose a backend or import the technology stack of a reference game. [Project information](PROJECT_INFO.md)

## Source and coverage record

| Reference examined | Revision / access | What was compared |
|---|---|---|
| [Winemaker04](https://github.com/gram12321/winemaker04/tree/0c5f9b301457a143a4c686ba2449f215c97f1e16) | `0c5f9b301457a143a4c686ba2449f215c97f1e16`, local `main`; later than the transition overview's `f3f4dade` | Feature, service, database, type, constant, UI and migration trees; targeted callers and selected tests. Existing unrelated vessel-panel changes and an untracked migration were left untouched; findings cite committed source. |
| [Industri Clicker](https://github.com/gram12321/industriClicker/tree/39e1d68db71107ef3b1263f853be2d618cf9ec7f) | `39e1d68db71107ef3b1263f853be2d618cf9ec7f`, local `tutorial` branch | Finance, lenders, research, gates, grants, market pools, staffing/training, achievements, prestige and local saves. Its Android/foreground-time choices are specific to that game. |
| [VisualIdle](https://github.com/gram12321/visualidle/tree/8d186331e838ab49c82fb11d9452ba09a9e0b893) | Local `main` at `692e6ba6963ce58029dfa908a7c5a76b9da484cd`, two commits ahead of the linked remote revision `8d186331e838ab49c82fb11d9452ba09a9e0b893`; private, with an unrelated modified handoff document | Research validation and effects, snapshot persistence and application wiring. Links cite the accessible remote revision, which supports the same claims; local persistence validation has additional changes. Source implements research despite stale repository guidance claiming otherwise. |
| [Simulus01](https://github.com/gram12321/Simulus01/tree/c39631701b0a1dcbb8ae0d13993747f5ca929336) | `c39631701b0a1dcbb8ae0d13993747f5ca929336`, `main` | Local/global market mechanics, product hierarchy, worker population and local storage. One Simulus-named repository was found on the researched account; other series repositories may exist elsewhere or under different names. |
| [TraderGame04](https://github.com/gram12321/tradergame04/tree/a9bd719fb6ff6773cf49033a59f02dd7a97b72ab) | `a9bd719fb6ff6773cf49033a59f02dd7a97b72ab`, `main` | Supply-sensitive local prices, resource bundles and Supabase snapshot persistence. |
| [TraderGame02](https://github.com/gram12321/tradergame02/tree/9de4106e3ca8ccdaef893571ab01745acf210068) | `9de4106e3ca8ccdaef893571ab01745acf210068`, `main` | Market listings, purchase status, and notifications. |
| [TraderGame01](https://github.com/gram12321/tradergame01/tree/45ada828bd88eea11fba2cb2d62fcfe95049ef5e) | `45ada828bd88eea11fba2cb2d62fcfe95049ef5e`, `main`; private | Direct company-to-company trade and Firestore settlement. Access to linked source requires repository permission. |
| [TraderGame](https://github.com/gram12321/tradergame/tree/ac8e60205a8d4389fad135c3a31dcb993cd53257) | `ac8e60205a8d4389fad135c3a31dcb993cd53257`, `main`; private | Earlier market transaction flow, compared to TraderGame01. |
| [SkiClicker](https://github.com/gram12321/Skiclicker/tree/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b) | `4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b`, `main` | Loan/credit, weather, prestige, achievement and persistence implementations. |
| [Baseclicker](https://github.com/gram12321/Baseclicker/tree/dac6c46d0e898ba45f7b6fca1556c8378de3268a), [Proto Production](https://github.com/gram12321/protoproduction/tree/c9230ec78a46b622858dd00ee52cee291cecf57f), [WhiskeyMixer](https://github.com/gram12321/WhiskeyMixer/tree/8cebe03fbe2ed19715a3825d50c19119c14d58f6) | `dac6c46`, `c9230ec`, `8cebe03`; default branches | Additional market, research, snapshot and cask comparisons. Proto Production's retail demand is the main additional candidate; the others are narrower references. [X1] [X2] [X3] |

This is a broad source inventory, not a line-by-line audit of every catalog entry, branch, database deployment, RLS policy, or user journey. A named implementation is a *comparison candidate*, not proof that the whole system is more mature. Private source links require access. None of the games, database operations, or existing tests were run for this research.

## System and subsystem inventory

### 1. Game foundation and company setup

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Calendar, weeks, seasons and years | **Implemented:** player time advancement drives dated seasonal/yearly processing. [W1] | **Migrate 04:** retain the game-calendar concept; decide granularity, pacing and offline behavior. The UI design already calls for a calendar and Advance Time control. |
| Tick coordination and process ordering | **Implemented:** weather and vineyards update before staff work; sales, finance, wine and other recurring work follow. Some work runs in parallel. [W1] | **Rewrite:** define ownership, deterministic ordering, failures and repeatability around 05 domains; use 04 ordering as a dependency checklist. |
| State loading, activation and refresh | **Implemented:** active-company orchestration and UI update events exist. [W2] | **Rewrite:** establish 05's source of truth, commands, subscriptions and save boundary without adopting 04's global refresh pattern automatically. |
| Company/profile lifecycle and multiple companies | **Implemented:** company setup and active-company restoration. [W2] [W3] | **Migrate 04:** preserve company isolation and evaluate multiple-company UX; choose identity and storage separately. |
| Country/family starts and mentor | **Implemented:** scenarios assemble starting resources, staff, land, loan, prestige and research, plus mentor welcome. A guided tutorial is future work. [W3] | **Migrate 04:** review each scenario, character and story as authored content; map to 05 only where still meaningful. Do not assume old values or a guided tutorial. |
| Founder compensation and buyout | **Implemented:** founders can receive profit-based returns and be bought out into salaried staff. [W4] [W61] | **Migrate 04:** assess as a distinct ownership choice; do not confuse it with the inactive full share system. |
| Static catalogs and tuning | **Implemented:** grape, staff, regional, economy, market, weather, equipment and scenario catalogs exist. [W5] | **Rewrite:** reuse researched content selectively after domain review; keep tunables with the eventual owning 05 systems. |
| Old public company, board and shares | **Inactive:** facade exists but has no host wiring; old tables were removed. [W6] | **Decide / defer:** a full ownership/share game is a separate product choice. **Do not migrate** the inactive facade as if it were playable. |

### 2. Finance, loans and economic context

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Cash, transactions and categories | **Implemented:** company-scoped cash transactions carry dates and categories. [W50] | **Update from another game:** compare Industri Clicker's typed, signed ledger and coalescing with 04's game-dated ledger; map sources to 05 events and currency. [I1] |
| Player wallet and company capitalization | **Implemented:** the player has a cash balance separate from company cash, and company creation can draw an initial investment from it. [W62] [W63] | **Decide / defer:** decide whether 05 needs a player-level portfolio and funding across companies; no later withdrawal or dividend behavior is assumed. |
| Income statement, cash flow, balance sheet and company value | **Implemented with valuation issues:** 04 separates capital flows, reports company assets and debt; buildings are zero and grape batches appear in two asset components. [W7] | **Rewrite:** create consistent 05 valuations for land, lots, vessels, buildings, debt and historical cost; compare Industri's breakdowns, not its industrial asset formula. [I4] |
| Economy phases | **Implemented:** seasonal phases influence business context including lending and sales. [W8] | **Migrate 04:** retain as a candidate macroeconomic layer; rebalance magnitude, timing and interactions if desired. |
| Lenders, profiles and search | **Implemented:** lender types and traits, search criteria, offers and staff-work-based discovery. [W10] [W52] | **Update from another game:** compare SkiClicker's lender-specific credit limits/search and Industri's lender portfolios against 04's activity integration. [S1] [I5] |
| Credit score and rating | **Implemented:** asset health, payment record, stability and negative balance contribute. [W11] | **Update from another game:** compare explainable factor and limit breakdowns in 04, SkiClicker and Industri; derive 05 inputs from corrected valuation and loan accounting. [S1] [I5] |
| Loan quotes, fees and schedules | **Implemented:** terms, interest, origination costs and scheduled payments are calculated. [W10] | **Rewrite:** specify principal, interest accrual, fees, schedule and rounding with scenario checks; 04 payment updates need investigation. Compare Industri and SkiClicker for candidates. [I5] [S1] |
| Repayment, missed payments and default | **Implemented:** early/extra payments, penalties, liquidation, default, blacklist and restructuring paths. [W10] | **Update from another game:** compare escalation and recovery in all three implementations; connect to 05 assets, notifications and time without inheriting thresholds. |
| Emergency borrowing and liquidity recovery | **Implemented:** forced quick-loan and later recovery behavior exist. [W10] | **Migrate 04:** review whether automatic borrowing, seizures and player consent create the intended experience; distinguish them from normal loans. |
| Bookkeeping | **Implemented:** seasonal administrative work depends on transactions and loan penalties; unfinished work can carry forward and affect prestige. [W51] | **Migrate 04:** preserve as a candidate staff activity; tune frequency and consequences with finance and time design. |

### 3. People, training, teams and work

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Staff records, generation and recruitment | **Implemented:** generated candidates, searches, selection, hiring and dismissal. [W15] | **Migrate 04:** adapt the individual-person model and recruitment flow to 05 company setup and activities. |
| Wages and compensation | **Implemented:** skills and specialization feed wages; payments occur on a recurring cadence. [W4] | **Migrate 04:** integrate with 05 ledger and staffing rules; retain founder treatment only if chosen. |
| Primary skills and career roles | **Implemented with a gap:** broad skills and career-role bonuses feed work, but a sales skill and Sales Team exist without a corresponding sales activity category found in the inspected work mapping. [W16] [W64] | **Migrate 04:** review the skill taxonomy and skill/work contribution against 05 activities, including whether sales should use staff work. |
| Task and grape mastery | **Implemented:** applied work earns task-specific and, where relevant, grape-specific experience. [W16] [W53] | **Migrate 04:** preserve the learning-from-doing candidate; choose progression speed and how mastery affects a specific action. |
| Explicit training | **Not found as a separate 04 staff activity:** learning happens through work; a research description mentions training. [W16] [W65] | **Update from another game:** compare Industri's scheduled, paid training that temporarily removes workers from available capacity. Its workers are an aggregate facility model, so design an individual/team version if desired. [I2] |
| Teams and default assignments | **Implemented:** staff can be grouped and activities can select matching teams. [W17] | **Migrate 04:** keep groups and assignment suggestions as candidates; decide membership, availability and scheduling rules. |
| Activity lifecycle and assignment | **Implemented:** creation, work, pause/cancel and completion paths; active activities progress each tick and some handlers are partial. [W9] | **Migrate 04:** adapt the scheduling model to 05, with explicit task states, ownership, cancellation and resource release. |
| Work allocation and previews | **Implemented:** skills/mastery, task sharing and group-size effects feed work calculations used for previews and progress. [W16] | **Migrate 04:** retain one explainable calculation path for actual work and previews; re-evaluate multitasking and diminishing returns. |
| Operational work categories | **Implemented:** land and staff searches, clearing, planting, harvest, crushing, fermentation setup, vessel maintenance, research, bookkeeping and lender/loan work. [W9] | **Rewrite:** integrate each handler with its 05 domain and lot lifecycle; preserve work and cancellation concepts where useful. |
| Building and upgrade activities | **Partial:** activity categories exist but completion handlers contain TODOs. [W9] | **Rewrite:** implement only after buildings/facilities are designed; **do not migrate** the TODO as completed construction. |
| Weather and resource limits on work | **Implemented:** weather affects planting and harvesting work, and storage availability can constrain harvest work. [W19] [W18] | **Migrate 04:** keep effects visible in previews and work outcomes; define which domain owns the constraint and actual applied work. |

### 4. Research, grants and progression gates

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Research project catalog and branches | **Implemented:** projects define prerequisites, work, costs, rewards and unlocks. [W12] | **Update from another game:** combine 04's staff-work project concept with Industri's typed project/effect catalogs and VisualIdle's catalog validation; design 05 subjects and UX. [I3] [V1] |
| Eligibility and blocking | **Partial:** project gates include prerequisites, company value/age, prestige, buyer loyalty and achievements; enforcement of outputs differs by consumer. [W13] | **Rewrite:** define common capability checks and enforce them at domain-command boundaries, with UI reasons derived from the same decision. |
| Grants / funding projects | **Implemented:** 04 has project rewards and prerequisites in grant tracks. [W12] | **Migrate 04:** retain as candidate funding/progression gameplay. Separately compare Industri's one-use action-cost grants; these are different mechanics. [I6] |
| Work, costs, cancellation and rewards | **Implemented:** staff activity advances research and completion grants configured outcomes. [W14] | **Update from another game:** compare Industri's active-project ledger, capacity and recorded cancellation costs; adapt to staff time and ensure completion/reward idempotency. [I3] |
| Capability unlocks | **Partial:** vineyard caps, contract generation and buyer modifiers have consumers; grape/fermentation checks were found in UI, while staff-cap enforcement was not found. [W13] [W14] | **Rewrite:** inventory and test each future gate's actual command consumer. Do not assume catalog entries alone block actions. |
| Permanent effects | **Implemented:** vineyard health decay, research skill, administration/research work and all-staff work multipliers have calculation and consumer paths. [W20] | **Migrate 04:** retain typed effects as a candidate; each 05 domain should interpret its own effect and balance. |
| Tree validation and dependencies | **Implemented in comparison games:** VisualIdle validates IDs, references, cycles, positions and effects; Industri uses typed gate contexts. [V1] [I7] | **Update from another game:** use these as stronger validation references for a 05 catalog if a tree is retained; multi-project purchase is a separate gameplay choice. |

### 5. Land, weather and vineyard dependencies

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Land search, purchase, site and vineyard capacity | **Implemented:** land generation/search, purchase and capacity limits. [W21] | **Migrate 04:** review geographic/site data and expansion decisions; connect site potential and commercial origin to the agreed 05 distinctions. |
| Clearing, planting, density, overgrowth and maintenance | **Implemented:** field work and vineyard state affect operations. [W21] [W9] | **Migrate 04:** retain useful choices and work model; redesign rules and effects around the 05 vineyard. |
| Grape variety, suitability and vineyard growth | **Implemented:** variety/site data, aging, vine yields, ripeness and health. [W5] [W21] | **Rewrite:** connect source material to the new harvest and potential model; old numbers are examples, not 05 constants. |
| Seasonal forecast and weekly weather | **Implemented:** a seasonal outlook, confidence and dated weather context are resolved and persisted. [W22] [W66] | **Migrate 04:** use as the strongest winery-specific starting point; choose reproducibility, information and forecast accuracy. |
| Site exposure and vineyard projection | **Implemented:** aspect, altitude, soil and grape suitability influence weather-related ripeness and health projections. [W23] | **Migrate 04:** retain site-sensitive cause/effect; recalibrate against the 05 agricultural model and time scale. |
| Planting and harvest effects | **Implemented:** weather can affect planting and harvesting speed/availability, and vineyard state is updated before activity work. [W19] [W1] | **Migrate 04:** keep the integration visible to players; explicitly test harvest timing and partial work in the future implementation. |
| Market weather effects | **Implemented:** weather contributes to grape buyer-market volatility. [W25] | **Migrate 04:** compare whether markets react to weather locally, regionally or globally after the market/time authority is selected. |
| Wine development and sensory model | **Implemented in 04; redesign already described separately.** [W26] | **Rewrite:** follow the [transition overview](Winemaker04_to_05_Transition_Overview.md); keep inherited potential, development, sensory evaluation and commercial value distinct. |

### 6. Inventory, vessels, facilities and production history

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Grape, must and bottled-wine inventory | **Implemented:** batches have quantities, origin and lifecycle information; harvest and market sources create batches. [W27] | **Rewrite:** base all reservations, trading, transfers and valuation on 05 lot/material ownership and units. |
| Storage vessel catalog and ownership | **Implemented:** fixed-capacity casks, tanks and containers of different materials, with condition, cleanliness and use history. [W28] | **Migrate 04:** review the catalog as content; map individual vessels to 05 equipment and inventory. |
| Vessel reservation, allocation and release | **Implemented:** reserved/active/released plans and capacity constraints; cancellation must preserve wine already placed. [W18] | **Migrate 04:** preserve the allocation problem and cancellation invariants; make commands atomic under the chosen persistence model. |
| Cleaning, emptying and wear | **Partial:** cleaning/emptying activities and condition/history exist. Dirty vessels can be used with a warning, and cleanliness affects used-market value; a contamination effect was not found. [W28] [W29] [W67] | **Migrate 04:** retain as candidate maintenance work; decide gameplay effects and the interaction with contamination/faults. |
| Vessel contact, aging and material effects | **Configured/partial:** contact and expression calculators exist, but no runtime source consumer was found. [W30] | **Rewrite:** make vessel material, history and storage conditions causally affect the 05 development engine; do not claim the 04 formulas are already wired. |
| Used-vessel sale and procurement | **Implemented:** owned vessels can move into used-market custody and be purchased. [W56] | **Migrate 04:** integrate with the common trading contract and 05 equipment ownership; distinguish it from storage facilities. |
| Buildings and general storage facilities | **Partial:** construction activity completion is TODO and financial building valuation is zero. [W9] [W7] | **Rewrite:** design buildings, site capacity, upgrades and facility storage as new 05 systems if desired. Industri's facility and maintenance systems are comparison candidates, not a winery design. [I2] |
| Bottling/production history and vineyard analytics | **Implemented:** historical bottling snapshots and vineyard statistics exist. [W31] | **Migrate 04:** retain history and analysis, but specify which 05 lot facts are immutable snapshots versus current derived results. |

### 7. Markets, sales, customers and contracts

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Shared buy-market model and adapters | **Implemented for two ware groups:** grapes and storage vessels; supplier, NPC and company-origin offers share view/lifecycle contracts. [W32] | **Migrate 04:** adapt common offer, source, lifecycle and counterparty interfaces; keep product-specific quality, delivery and pricing separate. Expand wares only after their inventory rules exist. |
| Local supplier stock and relationships | **Implemented:** company-specific procurement offers and counterparty relationship data. [W32] [W60] | **Migrate 04:** retain as a distinct procurement choice; decide stock refresh, loyalty, quantities and pricing per good. |
| Local seasonal grape buyers | **Implemented:** buyers have seasonal capacity, loyalty and market behavior. [W25] [W71] | **Migrate 04:** adapt winery-specific sales and relationship behavior; re-evaluate volume and season rules. |
| Bulk grape sale and company-origin listings | **Implemented:** selling pays an upfront amount and transfers goods into market custody for later purchase; a later seller settlement was not found in the inspected purchase path. [W24] [W45] | **Migrate 04:** keep as a candidate liquidity/wholesale route; disclose its economic model separately from direct P2P settlement. |
| Direct player/company-to-company trade | **Partial in 04:** company-origin goods are visible to others, but the observed bulk route is not direct seller settlement. [W24] | **Update from another game:** use TraderGame01 as the strongest inspected direct-trade comparison; redesign its transaction and security boundaries. [T1] |
| Shared listing timing, decay and expiry | **Implemented with an open authority problem:** grape listing evolution is projected from the viewing company's game date. [W33] | **Rewrite:** choose shared clock, listing authority, snapshot/quality evolution, concurrent sale and settlement before promising a fair global market. |
| NPC market supply and generation | **Implemented:** NPC-generated shared offers and local suppliers coexist. [W32] | **Migrate 04:** separate supply generation from shared ownership/settlement. Compare Proto Production's follower NPC and retail demand only if richer competition is wanted. [X2] |
| Pricing, quotes and quality | **Implemented:** 04 has product-specific buy/sell quotes and commercial valuation. [W32] [W24] | **Update from another game:** compare TraderGame04's transaction pricing over changing supply and Industri's pool/quality mechanics, while keeping wine-specific origin and quality rules. [T2] [I8] |
| Local/regional/global diffusion and automation | **Implemented in sibling games:** Simulus and Industri simulate supply movement; Industri also supports automated local trades. [M1] [I8] | **Decide / defer:** useful for a simulated commodity economy; not evidence of a shared multiplayer market or an automatic fit for wine. |
| Wine customers, orders and relationships | **Implemented:** customer acquisition, orders, buyer attributes and relationships. [W34] | **Migrate 04:** preserve the successful commercial gameplay identified in the overview; adapt orders to 05 lots, price and customer context. |
| Wine contracts and presales | **Implemented:** generated offers, requirements, expiry and fulfillment/default. [W35] | **Migrate 04:** review the requirements and lifecycle against 05 wine evaluation and inventory availability. |
| Forward contracts | **Implemented:** separate offers and delivery/default obligations can target grapes, must, bottled wine or any supported state. [W36] | **Migrate 04:** retain as a distinct cash-flow and production-planning choice if 05 supports the promised goods and dates. |
| Cooperative membership and price floors | **Implemented:** cooperative and related grape-selling mechanics. [W37] | **Migrate 04:** evaluate as a separate farmer/seller relationship rather than collapsing it into NPC spot prices. |
| Resource bundles and substitution | **Implemented in comparison games:** TraderGame04 resolves hierarchical bundles; Proto Production models retail demand and seller allocation. [T3] [X2] | **Decide / defer:** consider only when 05 offers mixed products or comparable substitutions; retain individual wine/lot identity. |

### 8. Prestige, achievements and player feedback

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Company prestige and event history | **Implemented:** permanent/recalculated and decaying positive/negative events cover finance, sales, research and more. [W38] | **Update from another game:** compare 04's winery-rich event types with Industri's event ledger and derived current amounts. Define event identity and time ownership. [I9] |
| Vineyard reputation and origin | **Implemented in 04:** vineyard-related events and factors are tracked alongside company prestige. [W38] | **Rewrite:** align with 05's agreed Terroir Potential / Origin Prestige distinction; decide whether vineyard reputation, origin and company prestige are separate. |
| Cellar collection prestige | **Implemented:** a recalculated component depends on retained, aged wine and other conditions. [W68] | **Migrate 04:** keep as a candidate incentive; re-specify eligibility and valuation for 05 lots and maturation. |
| Prestige decay and relationship decay | **Implemented:** decaying events exist; a 04 React hook participates in decay. [W39] | **Rewrite:** put authoritative advancement in the chosen time/domain process; compare Industri's derived event decay. [I9] |
| Achievements and tiers | **Implemented:** varied finance, production, vineyard, cellar and sales conditions; rewards can affect prestige. [W40] | **Update from another game:** compare Industri's post-command evaluation and idempotent achievement events; design new milestones around 05 behavior. [I10] |
| Online leaderboards and high scores | **Implemented in 04:** company, vineyard, wine and price-related records. [W41] | **Decide / defer:** review asynchronous competition, identity, fairness across clocks and server trust before selecting categories. |
| Notifications, history and toasts | **Partial:** dated messages and filters are persisted, and toasts are optional; individual read/dismiss state is in memory. [W42] [W59] | **Migrate 04:** preserve useful notification behavior; decide durable read state, deduplication, batching and which events deserve alerts. |
| Player reference and help | **Implemented:** Winepedia and Weather Center expose domain reference and weather information. [W43] | **Migrate 04:** retain useful explanations, rewritten for 05; use the UI redesign for presentation. |

### 9. Persistence, online services and development support

| System / subsystem | 04 evidence and status | Authorized disposition and 05 dependency |
|---|---|---|
| Game-state persistence and restoration | **Implemented:** Supabase adapters store company-scoped domain records and restore active state. [W2] [W44] | **Rewrite:** define save boundaries, consistency and failure behavior for 05; compare 04's remote records with VisualIdle's validated snapshot and Industri's company-scoped SQLite. [V2] [I11] |
| Supabase auth and account / local profile | **Implemented:** authenticated and local-profile paths exist; the local profile still uses a database adapter, so this does not establish offline-only saves. [W44] [W72] | **Decide / defer:** choose accounts, local play, portability and cloud sync from product needs. Supabase remains a candidate, not a selected 05 provider. |
| Shared-market storage and authority | **Implemented in 04:** database functions and locks support shared purchases. [W45] | **Rewrite:** separate private saves from server-authoritative shared listings; compare TraderGame01's transaction and 04's database approach, including access control and idempotency. [T1] |
| Preferences and last-company selection | **Implemented:** browser-stored preferences and selection. [W46] | **Migrate 04:** retain useful preferences independently of game state; use 05 UI decisions to decide what should persist. |
| Save schema compatibility | **04 has a database schema and migrations.** [W44] | **Decide / defer:** no 05 save exists yet; do not introduce a 04 migration or compatibility layer without an explicit need. |
| Admin, automated-test adapter and Gameflow Lab | **Implemented as development-only tooling:** fixture creation/cleanup and test adapter are isolated from production. [W47] | **Migrate 04:** keep test-lab concepts as an engineering candidate; implement only when 05 has corresponding game systems. |
| Legacy dev UI, old adapters and unused code | **Mixed:** historical and dormant modules remain in reference repositories. [W6] | **Do not migrate:** copy no unconnected runtime facade, old UI, schema or compatibility wrapper merely because it exists in 04. |

## Cross-game comparisons and recommended starting points

| Need | Best evidence found | Why it is useful / what remains unproven |
|---|---|---|
| Loan accounting and lender management | **Industri Clicker + SkiClicker**, with 04 for staff activities and winery assets. Industri's scheduled payment explicitly separates interest and principal; SkiClicker has lender-specific limits, search, early repayment and defaults. [I1] [I5] [S1] | Stronger concrete accounting and search comparisons than copying 04's payment path unchanged. Industri's periods are foreground minutes; SkiClicker's rules are tied to its stores, and its saved history is capped. Neither is verified as a complete 05 finance package. |
| Staff training | **Industri Clicker** has paid, scheduled facility-worker training; workers in training are temporarily unavailable. 04 has richer named individual skills, team and task/grape mastery. [I2] [W16] | Combine the *choice and opportunity cost* with 04's individual model if explicit training is wanted. Do not substitute Industri's aggregate workers for people and teams without a product decision. |
| Research, gates and grants | **04 + Industri + VisualIdle.** 04 provides work-driven projects and grant rewards; Industri has separate typed gates, project ledger/effects and one-use action grants; VisualIdle validates catalog graphs and typed effects. [W12] [I3] [I6] [I7] [V1] | This is a combination of complementary mechanisms, not one winner. Decide the role of research, which outcomes are unlocked, whether grants are rewards or waivers, and whether staff time is required. |
| Shared trading and settlement | **TraderGame01** uses a Firestore transaction for listing, buyer, seller, stock, capacity and balances; **04** has shared listings, product-specific custody and database-side locking. [T1] [W45] | TraderGame01 is the clearest inspected direct P2P comparison. Its reservation read occurs outside the transaction and can return zero on error; asynchronous audit writes are initiated inside a retryable callback. Rework concurrency, retries, permissions and idempotency before reuse. [T8] |
| Market prices, competition and regional supply | **TraderGame04** integrates price over supply change and resolves resource bundles; **Industri** and **Simulus01** simulate pool diffusion and quality; **Proto Production** has seller allocation and a follower NPC. [T2] [T3] [I8] [M1] [X2] | These are different local simulation techniques. Simulus's “global” market lives in device storage, and TraderGame04's inspected trading mutates player/local state. None establishes shared multiplayer authority. |
| Prestige and achievements | **04** has winery-specific company, vineyard and cellar events; **Industri** has event records, derived decay and idempotent achievement prestige events. [W38] [I9] [I10] | Compare event identity and calculation ownership; redesign the meaning and sources around 05. SkiClicker's prestige descends from Winemaker, but its achievement unlock IDs are in memory and can re-award after reload. [S2] [S5] |
| Weather | **04** is the strongest directly applicable baseline: forecasts, site exposure, vineyard state, planting/harvest work and buyer markets have actual consumers. [W1] [W19] [W22] [W23] [W25] | SkiClicker's weather-to-facility effects show another coupling pattern, but snow/ski formulas are not grape simulation. [S3] |
| Saves and authentication | **04** provides Supabase company records and auth; **VisualIdle** validates a versioned local snapshot and preserves an invalid existing save; **Industri** persists company snapshots in SQLite. [W44] [V2] [V3] [I11] | Choose local/remote/online needs first. A local snapshot adapter cannot alone provide shared-market authority. TraderGame04's separate building deletion/reinsertion does not demonstrate atomic multi-domain save. [T4] |
| Notifications | **04** and **TraderGame02** both have categorized, dated history and filters; inspected read/dismiss actions are in memory. [W42] [T5] [T7] | A common notification interface is plausible, but persistence of read state and delivery semantics require an explicit design. |

Additional comparison boundaries: TraderGame02's purchase operation is an explicit stub despite listing CRUD [T6]; TraderGame04's finance and achievement views and Simulus01's achievement view are placeholders, not finished alternatives. Simulus01 has population-based worker hiring rather than proof of 04-style individual skill/team activities [M2]. Baseclicker's versioned browser save, simple research and two-pool market are narrower references [X1]; WhiskeyMixer's store has cask assignment and age-based batch quality but is a small prototype, not evidence of a superior wine-development system [X3]. Proto Production's market is wired into its tick, but its industrial-city demand model is still an option for comparison, not a winery requirement [X2].

## Source-level risks to resolve before reuse

These findings are based on the inspected source and have **not** been reproduced against a running application or database. They are reasons to investigate, not claims about the state of a deployed service.

1. **04 asset valuation:** the statement calculates `wineValue` over all batch states, then adds a separate `grapesValue` for grape-state batches; building value is hardcoded to zero. This appears to double count grape-stage assets and omit buildings. Credit and company value relying on it need separate validation. [W7]
2. **04 loan balance:** loan origination initializes remaining balance from principal. A quoted amortized payment includes an interest rate, while the payment path subtracts the entire installment from the balance and clears it when the balance or term reaches zero. The statement path also treats the full payment and origination fee as capital flows, so no portion of that payment is separately reported there as interest expense. Verify scheduled interest, early payoff and total paid before porting. Industri's scheduled path explicitly computes interest and principal, although its own edge cases still need tests. [W10] [W57] [W69] [I1]
3. **04 research reward replay:** the UI marks completed projects, but the start routine checks active/paused duplicates and requirements without an explicit completed-project rejection. Completion awards money before the idempotent unlock insert. A stale/direct repeat path could therefore replay rewards; verify end to end and make the completion and reward boundary atomic/idempotent in any new design. [W14] [W48]
4. **04 research gates:** configured unlocks do not all have equivalent domain enforcement. In particular, staff-limit enforcement was not found; grape and fermentation checks were observed in the selection UI. Future code should verify each command independently. [W49] [W54] [W55]
5. **04 global grape full purchase:** the inspected migration declares `available_kg > 0`, while the purchase function sets it to zero when fully sold. That appears incompatible for a full purchase; a deployed database may have a different schema. [W58] [W45]
6. **Shared-market clocks and state:** 04 projects a listing at the viewing company's game date; buyers at different dates can see different projected conditions. The inspected purchase function locks the listing but also accepts client-provided cost and batch data and does not use its purchase ID as an idempotency check; actual exposure depends on deployed permissions and policies. TraderGame01's reservation and retry-side-effect boundaries also need work. A 05 design needs explicit authority for listing state, ownership, pricing, payment and delivery. [W33] [W45] [T1]
7. **Decay and event duplication:** 04 has prestige/relationship decay connected to a React hook; SkiClicker keeps achievement unlock IDs in memory while persisting prestige events. Put time effects under an explicit owner and make event/reward processing repeatable without duplicates. [W39] [S2] [S5]
8. **Snapshot history and read state:** SkiClicker saves a limited transaction history despite using it for finance calculations; 04 notification read/dismiss state is not durable. Decide which histories are authoritative and which state must survive reload. [S4] [W42]
9. **04 credit-history calculation:** the missed-payment term appears inverted: holding other inputs fixed, the weighted component rises as missed payments increase. The same code counts negative loan-payment transactions as on-time and estimates payoffs from payment count. These are source-level arithmetic observations, not a runtime reproduction. [W70]
10. **04 save failure handling:** the game-state adapter swallows save failures and returns the same null result for a load failure and missing data. Company activation can then initialize and save defaults when no economy phase was loaded. This is a source-level risk, not a reproduced loss incident; distinguish missing saves from failed reads and surface failed writes in 05. [W66] [W2]

## Decisions to take into design

The authorized inventory leaves these focused decisions open:

1. **Player and market topology:** local-only, cloud save, shared asynchronous market, or some combination? Do companies have independent calendars, and who owns market time, prices, settlement and dispute/retry handling?
2. **People and work:** how much scheduling, multitasking and explicit training should the player manage? Which actions require people and which are automatic?
3. **Research and grants:** is a visible research tree desired, which capabilities can it gate, and should grant rewards, one-use subsidies and permanent effects coexist?
4. **Business depth:** which accounting statements, lender search, credit, default consequences, macroeconomic phases and founder arrangements are desirable?
5. **Products and facilities:** which tradable categories beyond grapes and vessels should exist? How should wine lots, buildings, vessel capacity, condition and provenance be represented?
6. **World and reputation:** how should weather, local markets, origin, vineyard reputation, company prestige, achievements and customer relationships affect one another?
7. **Save and online scope:** what must survive reload or move between devices; are accounts, notification read state, leaderboards and shared data required?
8. **Content:** which 04 starts, names, regions, grapes and other authored catalogs are worth carrying forward after the 05 mechanics are designed?

A sensible comparison sequence is to resolve the market/time and save-authority questions early, define 05 lots and company assets, then prototype small slices of finance, people/work, research and trade against those contracts. This is an investigation order, not an approved delivery roadmap or a change to the existing UI prototype scope.

## Source links

The following links are pinned to the revisions in the coverage table. Some links point to private repositories; access follows the repository's existing permissions.

[W1]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/core/gameTick.ts#L31
[W2]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/core/gameState.ts#L187
[W3]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/constants/startingConditions.ts#L46
[W4]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/staff/services/wageService.ts#L9
[W5]: https://github.com/gram12321/winemaker04/tree/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/constants
[W6]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/boardShare/feature.ts#L5
[W7]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/finance/financeService.ts#L316
[W8]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/finance/economyService.ts#L8
[W9]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activitymanagers/activityManager.ts#L23
[W10]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/loanLender/services/finance/loanService.ts#L130
[W11]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/loanLender/services/finance/creditRatingService.ts#L88
[W12]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/researchUpgrade/constants/researchCatalog.ts#L975
[W13]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/researchUpgrade/services/research/researchEligibilityService.ts#L52
[W14]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/researchUpgrade/services/activity/activitymanagers/researchManager.ts#L20
[W15]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activitymanagers/staffSearchManager.ts#L23
[W16]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/workcalculators/workCalculator.ts#L41
[W17]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/staff/services/teamService.ts#L202
[W18]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine/winery/storageVesselAllocationService.ts#L72
[W19]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activityWorkPreviewService.ts#L58
[W20]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/researchUpgrade/services/research/researchPermanentEffectsService.ts#L20
[W21]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/vineyard/vineyardService.ts#L331
[W22]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/weather/weatherResolver.ts#L70
[W23]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/weather/weatherVineyardService.ts#L50
[W24]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/sellGrapesService.ts#L304
[W25]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/grapeBuyerMarketService.ts#L139
[W26]: https://github.com/gram12321/winemaker04/tree/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine
[W27]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine/winery/inventoryService.ts#L645
[W28]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/constants/storageVesselConstants.ts#L12
[W29]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine/winery/storageVesselMaintenanceService.ts#L78
[W30]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine/winery/storageVesselExposureService.ts#L17
[W31]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/wineLog/services/wineLogService.ts#L23
[W32]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/market/buyMarketDomainRegistry.ts#L15
[W33]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/market/grapes/globalGrapeMarketLifecycleService.ts#L29
[W34]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/salesOrderService.ts
[W35]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/contractService.ts
[W36]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/forwardContractService.ts#L108
[W37]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/cooperativeService.ts#L5
[W38]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/prestige/services/prestigeService.ts#L305
[W39]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/hooks/usePrestigeAndVineyardValueUpdates.ts#L71
[W40]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/achievements/achievementService.ts#L363
[W41]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/leaderboards/services/leaderboardService.ts#L16
[W42]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/core/notificationService.ts#L126
[W43]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/App.tsx#L269
[W44]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/user/services/authService.ts#L28
[W45]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/migrations/20260720210000_add_global_grape_market.sql#L107
[W46]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/user/services/companyPreferencesService.ts#L1
[W47]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/admin/README.md#L3
[W48]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/database/core/researchUnlocksDB.ts#L71
[W49]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activitymanagers/staffSearchManager.ts#L149
[W50]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/finance/financeService.ts#L83
[W51]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activitymanagers/bookkeepingManager.ts#L22
[W52]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/loanLender/services/activity/activitymanagers/lenderSearchManager.ts#L121
[W53]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/services/activitymanagers/activityManager.ts#L582
[W54]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/ui/modals/PlantingOptionsModal.tsx#L45
[W55]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/activities/ui/modals/FermentationOptionsModal.tsx#L143
[W56]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/wine/winery/storageVesselService.ts#L73
[W57]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/loanLender/services/finance/loanService.ts#L1565
[W58]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/migrations/20260720210000_add_global_grape_market.sql#L14
[W59]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/database/core/notificationsDB.ts#L41
[W60]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/market/buyMarketCounterpartyRelationshipService.ts#L16
[W61]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/staff/services/staffService.ts#L45
[W62]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/user/services/userBalanceService.ts#L8
[W63]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/company/services/startingConditionsService.ts#L104
[W64]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/types/types.ts#L6
[W65]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/researchUpgrade/constants/researchCatalog.ts#L685
[W66]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/database/core/gamestateDB.ts#L12
[W67]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/market/storageVessels/usedStorageVesselMarketService.ts#L38
[W68]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/prestige/services/prestigeService.ts#L552
[W69]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/constants/financeConstants.ts#L71
[W70]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/loanLender/services/finance/creditRatingService.ts#L247
[W71]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/services/sales/grapeBuyerMarketService.ts#L618
[W72]: https://github.com/gram12321/winemaker04/blob/0c5f9b301457a143a4c686ba2449f215c97f1e16/src/lib/features/user/services/authService.ts#L256

[I1]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/finance/finance.ts#L324
[I2]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/facilities/facility.ts#L284
[I3]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/research/research.ts#L176
[I4]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/finance/financeStatements.ts#L116
[I5]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/finance/loanService.ts#L75
[I6]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/grants/grant.ts#L1
[I7]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/gates/gate.ts#L21
[I8]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/market/market.ts#L193
[I9]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/prestige/prestige.ts#L72
[I10]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/core/stores/gameStore.ts#L306
[I11]: https://github.com/gram12321/industriClicker/blob/39e1d68db71107ef3b1263f853be2d618cf9ec7f/game/core/persistence/gameSaveDatabase.ts#L7
[V1]: https://github.com/gram12321/visualidle/blob/8d186331e838ab49c82fb11d9452ba09a9e0b893/src/game/research/ResearchRules.ts#L27
[V2]: https://github.com/gram12321/visualidle/blob/8d186331e838ab49c82fb11d9452ba09a9e0b893/src/app/GamePersistence.ts#L445
[V3]: https://github.com/gram12321/visualidle/blob/8d186331e838ab49c82fb11d9452ba09a9e0b893/src/app/main.tsx#L27
[M1]: https://github.com/gram12321/Simulus01/blob/c39631701b0a1dcbb8ae0d13993747f5ca929336/src/lib/resources/market/marketDiffusionService.ts#L29
[M2]: https://github.com/gram12321/Simulus01/blob/c39631701b0a1dcbb8ae0d13993747f5ca929336/src/lib/population/workerService.ts#L96
[T1]: https://github.com/gram12321/tradergame01/blob/45ada828bd88eea11fba2cb2d62fcfe95049ef5e/src/lib/firebase/marketService.ts#L428
[T2]: https://github.com/gram12321/tradergame04/blob/a9bd719fb6ff6773cf49033a59f02dd7a97b72ab/src/lib/market/marketService.ts#L76
[T3]: https://github.com/gram12321/tradergame04/blob/a9bd719fb6ff6773cf49033a59f02dd7a97b72ab/src/lib/market/resourceBundleResolver.ts#L31
[T4]: https://github.com/gram12321/tradergame04/blob/a9bd719fb6ff6773cf49033a59f02dd7a97b72ab/src/lib/gamemechanics/gameState.ts#L179
[T5]: https://github.com/gram12321/tradergame02/blob/9de4106e3ca8ccdaef893571ab01745acf210068/src/lib/services/core/notificationService.ts#L70
[T6]: https://github.com/gram12321/tradergame02/blob/9de4106e3ca8ccdaef893571ab01745acf210068/src/lib/services/market/marketService.ts#L277
[T7]: https://github.com/gram12321/tradergame02/blob/9de4106e3ca8ccdaef893571ab01745acf210068/src/lib/services/core/notificationService.ts#L208
[T8]: https://github.com/gram12321/tradergame01/blob/45ada828bd88eea11fba2cb2d62fcfe95049ef5e/src/lib/firebase/contractService.ts#L441
[S1]: https://github.com/gram12321/Skiclicker/blob/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b/src/engine/economy/LoanCreditSystem.ts#L483
[S2]: https://github.com/gram12321/Skiclicker/blob/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b/src/engine/prestige/achievementService.ts#L12
[S3]: https://github.com/gram12321/Skiclicker/blob/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b/src/engine/weather/WeatherSystem.ts#L16
[S4]: https://github.com/gram12321/Skiclicker/blob/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b/src/stores/financeStore.ts#L157
[S5]: https://github.com/gram12321/Skiclicker/blob/4cb5802d31ecb8858d0d4c2514d653ce7fd5cf0b/src/stores/prestigeStore.ts#L23
[X1]: https://github.com/gram12321/Baseclicker/blob/dac6c46d0e898ba45f7b6fca1556c8378de3268a/src/lib/game/saveGame.ts#L36
[X2]: https://github.com/gram12321/protoproduction/blob/c9230ec78a46b622858dd00ee52cee291cecf57f/src/lib/services/marketplace/marketplaceDemand.ts#L443
[X3]: https://github.com/gram12321/WhiskeyMixer/blob/8cebe03fbe2ed19715a3825d50c19119c14d58f6/src/store/gameStore.ts#L75
