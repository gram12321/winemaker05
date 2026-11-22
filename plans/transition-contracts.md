# Transition implementation contracts

Status: active implementation choices under the user's core-loop authorization. These are tunable game-model decisions, not claims that previously open formulas were approved. Read domain `types.ts` files as the exact signatures. Root owns these files and cross-domain integration; request a contract change rather than editing them from parallel work.

## State and units

- Company assembles `calendar`, `estate`, `winery`, `inventory`, `equipment`, `work`, `finance`, `commercial`, `week` (elapsed weeks starting 0), and `sequence` (next deterministic entity suffix).
- Vineyard types own four individually selected prototype varieties (Pinot Noir, Tempranillo, Sauvignon Blanc, Chardonnay), three prototype sites and growing crop/health/ripeness. Equipment owns individual steel/oak/concrete vessels; inventory owns their occupancy through a holding's `vesselId`.
- One physical vessel holds one coherent live liquid lot. Press/transfer/split require an empty destination; blending can reuse a source vessel after explicitly consuming its input lots. Capacity alone does not permit two independent developing wine states to silently share a container. Inventory owns this allocation rule; the schema checks it too.
- A `PhysicalLot` stores concentrations/normalized capacities, form, immutable origin/anchors, lineage, process settings, history and a nullable historical bottling assessment. No amount/placement on the lot. Inventory owns exactly one positive holding per live lot. Amounts are integer grams for grapes, integer ml for must/wine, integer 750-ml bottle counts for bottled wine. Every independently developing portion has its own lot ID.
- `PhysicalState` units: sugar g/L; alcohol percent; age days integer; oxygenExposure and maturation nonnegative; other dimensions normalized 0..1. Raw anchors use sugar g/L and normalized dimensions. Fermentation must conserve consumed sugar to alcohol with a named yield, extraction cannot exceed inherited phenolic capacity, maturation is allowed above 1 to support decline.
- `WineEnvironment` contains actual temperature, oxygen ingress, oak strength and contamination pressure; resolve from holdings + equipment, not persisted twice on wine. Process temperature is a controlled fermentation choice; cellar temperature applies outside active fermentation.
- Environment scales: Celsius temperature; `oxygenIngress` normalized exposure units/day (typical provisional baselines steel0.0008, oak0.006, concrete0.003, bottle0.0002 before headspace/condition effects); oakStrength and contaminationRisk are normalized0..1. Risk accumulation owns temperature effects on faults. Fermentation must respond to actual Celsius, never merely closeness to the player's requested temperature. Stall yeast threshold is0.08, below the0.24 restart floor.
- All outputs are plain JSON, readonly at public boundaries. Root performs current-schema validation and deep copying/freezing. No undefined persisted fields or compatibility defaults for older saves.
- `WineryState.archivedLots` preserves consumed parents and sold/bottled source lots as historical records; only `lots` develop and require holdings. Every lot also carries immutable `sources` (origin, anchors, fraction) so blends retain all source identities. Finance now includes persistent `wageArrearsCents`; unpaid wages block new harvest work and are paid in due-order at week end.

## Planned domain APIs (coding agents own implementations)

- Topic01 `vineyard/Catalog.ts`, `vineyard/Rules.ts`: `GRAPES`, `SITES`; `createVineyard(...)`, `resolveWeather(...)`, `advanceVineyard(...)`, `harvestVineyard(...)`; actual signatures to be agreed in brief. Costs returned/calculated in domain; root composes finance.
- Topic02 `wine/Anchors.ts`, `wine/Operations.ts`: harvest lot construction, finite pressing, blend/split/bottle physical-state transforms. No inventory amounts stored or mutated in wine.
- Topic03 `vineyard/Origin.ts`: agricultural `terroirPotential(site, grape, condition)` and independent `originPrestige(site)` plus land valuation query. Inputs should use domain types, not CompanyState.
- Topic04 `evaluation/Sensory.ts`: pure six-axis current projection `deriveStructure(lot)`; no score inputs.
- Topic05 `evaluation/MovingTargets.ts`: generic range/weight evaluator with per-axis result/explanations, finite inputs and bounded scores.
- Topic06 `evaluation/Taste.ts`: pure family profile and descriptor projection from current material and grape identity.
- Topic07 `evaluation/Assessment.ts`: compose separate structure/taste fits and fault assessment, no physical mutation; historical bottling assessment constructed by root or wine operation from this output.
- Topic08 `evaluation/Profiles.ts`: bounded contextual structure/taste targets and explanation strings; no second synergy penalty.
- Topic09 `wine/Risks.ts`: causal oxidation/contamination/green/stall diagnoses from physical state/environment; engine calls physical risk advancement once per daily step.
- Topic10 `wine/Development.ts`: one `developLot(lot, environment, days)` consolidated entry point using canonical daily steps. Calls maturation/risk helpers. Does not mutate inventory or scores.
- Topic11 `wine/Maturation.ts`, `equipment/Rules.ts`: environmental mapping, capacity/condition/maintenance helpers and one maturation rule for bulk and bottled wine.
- Topic12 `commercial/Rules.ts`: authority-derived buyer quotes, contract generation/eligibility/deadline outcomes; returns composable effects, no direct persistence.

Exact integration signatures now required by primary code:

```ts
developLot(lot: PhysicalLot, environment: WineEnvironment, days: number): { lot: PhysicalLot; causes: readonly string[] };
resolveWineEnvironment(lot: PhysicalLot, holding: Holding, vessel: Vessel | null, cellarTemperatureC: number, occupiedMl?: number): WineEnvironment;
vesselPurchase(input: { id: string; material: VesselMaterial; capacityLitres: number }): RuleResult<{ vessel: Vessel; costCents: number }>;
vesselCapacityFreeMl(vessel: Vessel, holdings: readonly Holding[], exceptLotIds?: readonly string[]): number;
isUsableVessel(vessel: Vessel): boolean;
recordVesselFill(vessel: Vessel): RuleResult<Vessel>;
maintainVessel(vessel: Vessel): { vessel: Vessel; costCents: number };
ageVessels(vessels: readonly Vessel[], holdings: readonly Holding[]): readonly Vessel[];
assessWine(lot: PhysicalLot): WineAssessment;
createContractOffers(week: number): readonly WineContract[];
advanceContracts(state: CommercialState, week: number): CommercialState;
acceptContract(contract: WineContract, week: number): RuleResult<WineContract>;
quoteWine(lot: PhysicalLot, assessment: WineAssessment, buyerId: BuyerId, relationship: number, bottles: number): RuleResult<{ pricePerBottleCents: number; totalCents: number; reasons: readonly string[] }>;
contractEligibility(contract: WineContract, lot: PhysicalLot, assessment: WineAssessment, bottles: number, week: number): { eligible: boolean; reasons: readonly string[] };
recordSale(state: CommercialState, sale: Sale): CommercialState;
```

Root integrates current-schema validation, finances, work allocation, command reader/router, inventory transactions, ordered weekly tick and queries. Additional agents own UI, scenario tests and independent review when dispatched. UI consumes queries and sends commands; business rules stay in `src/game`.

Further exact APIs for remaining coding briefs:

```ts
evaluateProfile(values: Readonly<Record<string, number>>, targets: TargetProfile): ProfileAssessment;
deriveStructure(lot: PhysicalLot): StructureProfile;
deriveTaste(lot: PhysicalLot): { families: TasteProfile; descriptors: readonly string[] };
structureTargets(lot: PhysicalLot, profile: StructureProfile): TargetProfile;
tasteTargets(lot: PhysicalLot, profile: TasteProfile): TargetProfile;
diagnoseWine(lot: PhysicalLot): readonly WineFault[];
hasSeverePhysicalFault(lot: PhysicalLot): boolean;
advanceRisks(lot: PhysicalLot, environment: WineEnvironment, days: number): PhysicalState;
advanceMaturation(lot: PhysicalLot, environment: WineEnvironment, days: number): PhysicalState;
maturityOutlook(lot: PhysicalLot): { label: 'Developing' | 'In maturity window' | 'Declining'; progress: number };
```

Physical field responsibilities within the single development entry point: fermentation/extraction owns sugar, alcohol, yeast, expressed/remaining phenolics, active-process completion and ageDays; maturation owns acidity, aroma, maturation, oak and lees; risks owns cumulative oxygenExposure, oxidation, rot and greenCharacter. Helpers receive the updated lot sequentially and preserve other fields. Suggested canonical daily order: fermentation/extraction, maturation, risk, age increment. No helper persists independently. The engine alone returns one consolidated lot and cause strings. All assessments and bottling snapshots use scores 0..1. Reuse bottling/fermentable sugar thresholds from wine/Operations.ts (currently 4g/L).

`simulation/DevelopStoredLot.ts` re-resolves environment each day and calls the same `developLot(...,1)` engine. This handles fermentation finishing mid-week: later days use cellar temperature rather than retaining the old fermentation setpoint. Both live weekly advancement and forecasts use this helper. `Development.describeDevelopment(before,after)` supplies the aggregate physical-change summary without duplicating numeric rules in orchestration.

Risk diagnostic codes used by queries: `stuck-fermentation` for active conversion with remaining sugar and insufficient yeast; use `oxidation`, `spoilage`, `green-character` for other physical diagnoses. Risk owns severity thresholds and `hasSeverePhysicalFault`; maturation owns maturity-window thresholds and outlook labels, so cellar queries do not duplicate the process rules.

`queries/ActionPreviews.ts` evaluates the actual pure command and discards its candidate for press/transfer/split/blend destination feasibility and contract fulfillment readiness. Do not duplicate those material/capacity/cash rules in React. UI may format numbers/units, own form state and submit intents. Primary owns this query seam; UI agent requests missing read models.

The topic04 coder also owns connected UI in `App.tsx` and `components/game/**`; do not assign overlapping UI files to other coders. CompanyView, client and command types remain primary-owned. Individual topic tests run directly against their domain modules while cross-domain imports are still incomplete. The combined build and loop checks wait for all planned modules; no stubs or legacy fallbacks should be introduced to make an intermediate branch appear runnable.

## Tick and operations

Week advance: plan date/weather -> vineyard environment -> stable-priority work allocation -> develop lots that existed at interval start with daily steps -> apply feasible partial harvest and XP at interval end -> wages and due contracts -> history/date/week -> validate candidate. New harvest portions are separate lots so later ripeness does not rewrite earlier material; they receive zero development in their creation interval.

Operations are explicit, authority-validated commands: establish vineyard, begin/cancel/reprioritize harvest, buy/maintain vessel, press, start/manage/restart fermentation, transfer, split, blend, bottle, change cellar climate, sell and accept/reserve/fulfill contracts. Root will publish the exact command union before UI integration. All use existing stable IDs/revision receipts and retained browser intent recovery.

`wine.discard` explicitly removes a chosen unreserved quantity and records the loss in lot history. This allows failed material and sub-bottle remainders to release storage. It never pays cash or silently rounds away wine at bottling; fully consumed lots enter the archive.

## Scope

No shared market, full people/research/loan/building/progression subsystems or copied 04 catalogs/formulas. The minimum company-finance/work/NPC-commercial supports the authorized loop. Balance constants remain explicitly provisional and centralized in their domain implementation.
