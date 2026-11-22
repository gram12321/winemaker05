# 02 — Wine anchors: immutable inherited potential vs mutable development

**Status:** Research recommendation for design review, not implemented behavior. The approved boundary is in `docs/WorkingDocs/design.md` items 26–30: wine owns lot composition and development; inventory owns quantity, location, custody and allocations; equipment owns vessel properties; inherited potential is a harvest baseline, while remaining availability, degradation, exposure and process progress are mutable. Field names, units, equations and anchor count remain open.

## Current evidence

Winemaker05 has no wine domain yet. `src/game/core/CompanyState.ts` accepts only `calendar` and strictly rejects extra state fields; `src/game/core/Commands.ts` exposes only `time.advance`; `src/game/simulation/AdvanceTime.ts` advances the calendar and emits `time.advanced`. `src/server/postgres/PostgresCompanySavePort.ts` validates state through `readCompanyState` and stores its JSON representation, so introducing wine requires updating the authoritative state contract and its validator, not adding UI-owned fields or a legacy save path.

Winemaker04 demonstrates why the conceptual split matters, but not which fields 05 should use. `C:/GitHub/winemaker04/src/lib/services/wine/anchors/wineAnchorService.ts` computes harvest values from vineyard, grape and ripeness inputs, while its 12-key `WINE_ANCHOR_KEYS` combines potential-like fields (`sugarPotential`, `acidPotential`, `bodyPotential`) with process/development-like fields (`extractionState`, `fermentationState`, `leesState`, `oxidationPressure`, `maturationState`, `processFootprint`). `C:/GitHub/winemaker04/src/lib/services/wine/anchors/wineAnchorProcess.ts` mutates the same anchor object during crushing, fermentation and feature updates. The 04 `WineAnchorValues` comment in `C:/GitHub/winemaker04/src/lib/types/types.ts` calls these upstream identity, yet the key set itself mixes immutable origins with evolving state. Treat that as a modeling warning, not a 12-anchor requirement.

## Minimal 05 shape to evaluate

Keep three authoritative records with explicit ownership:

- `PhysicalLot`: stable `id`; immutable `origin` (harvest/source IDs, grape/vintage context, and `rawMaterialAnchors` snapshot); immutable `lineage` inputs for splits/blends; mutable `development` containing current material form, the minimum causal physical measurements, active process records/progress, and only those remaining-potential/exposure values the chosen anchor model needs.
- `InventoryPosition` keyed by lot: `quantity`, explicit `unit`, `location`, `custody`, and active vessel/storage allocation. Inventory is the quantity/location authority; do not also store a competing volume on `PhysicalLot`. Keep vessel material, capacity, condition and environment on equipment, referenced by allocation.
- `WineHistory` only for durable facts needed later (e.g. harvest, split/blend, bottling assessment snapshot), not a second event-sourced copy of current state.

Raw anchors should capture inherited potential at harvest and never be rewritten by fermentation, maturation or bottle aging. For split descendants, retain the same baseline and record parent/quantity lineage; each portion then gets independent mutable development. For a blend, preserve each source snapshot and create a new immutable baseline only through a separately specified blending rule. Do not freeze every potential into a consumable reservoir: track mutable availability only for dimensions designed to deplete or degrade.

Persist material form, physical facts, active processes/progress, inventory placement and durable history. Derive readiness labels, maturation categories and current sensory/evaluation outputs from those facts. A durable event such as bottling or market custody is explicit; “ready”, “mature” and “drink now” are views, not a four-state lifecycle enum copied from 04.

## Command and tick boundary; verification scenarios

Implement changes through pure commands against a validated company snapshot, committed once through the existing `src/authority/session.ts` company session and save boundary. Process starts, splits, transfers and blends are commands that validate ownership, available quantity, capacity and lineage; time advancement runs the one wine-development entry point. The approved tick order develops existing lots before applying work outcomes; harvest-created lots begin developing in the next interval. Use the approved daily internal development steps inside the weekly `time.advance`, with deterministic inputs and one consolidated result per lot.

Verify: (1) maturation changes development but leaves harvest anchors byte-for-byte fixed; (2) split conserves total inventory quantity and preserves identical anchor provenance while child development can diverge; (3) transfer changes allocation/location, and subsequent development uses the new conditions; (4) blend lineage and quantities reconcile, with its baseline traceable to source snapshots; (5) harvest output created at week end receives no development in that same interval; (6) malformed quantities, anchors or active-process records are rejected without replacing the saved state.