# Winemaker 04 → 05: Simulation Redesign Overview

Original chat: https://chatgpt.com/g/g-p-690d10f8c8e88191aabf8da4ef459b8c-winemaker-0-4-game-creation/c/6af60090-f84c-83ed-8c51-d84ad4cbb4d9

**Status:** Revised working design overview — transition from analysis of Winemaker04 to the proposed architecture and gameplay direction of Winemaker05<br>
**Discussion dates:** 12–13 November 2026 (revised 13 November)<br>
**Reference implementation:** [gram12321/winemaker04](https://github.com/gram12321/winemaker04)<br>
**Code revision examined in the discussion:** `f3f4dadeac2663b4744ca107a87cd1f1ad1122ac` (main, 22 July 2026)

> **Purpose of this document**<br>
> This document consolidates the full discussion about moving from Winemaker04 to Winemaker05. It is deliberately an extended design overview, **not** a short summary and **not** a final technical specification. It preserves the actual-code findings, gameplay interpretation, proposed architecture, trade-offs, examples, and uncertainties discussed. It separates what **04 does today**, what is **agreed as a direction for 05**, what has been **proposed but not yet decided**, and what requires **further investigation or design**. In particular, the numbers of anchors, structural characteristics, flavor families, and persisted lifecycle states in 04 are **descriptions of the old implementation, not mandatory specifications for 05**.
>
> The [system inventory](Winemaker04_to_05_System_Inventory.md) complements this overview with a proposed disposition of Winemaker04 staff, finance, research, market, persistence, progression, and online systems.

---

## 1. Executive framing: what is being redesigned?

Winemaker04 already contains the essential ingredients of the intended game: a vineyard and grape simulation, wine anchors, six wine characteristics, moving quality targets, a taste system, winemaking operations, evolving features and risks, aging, and a substantial commercial system involving pricing, sales, contracts, reputation, and cellar inventory.

The problem is not that these concepts need wholesale replacement. It is that they currently form several partially overlapping models with unclear boundaries and inconsistent input/output contracts. Multiple parts of the code can modify the same batch properties, some apparently important effects are configured but not applied as expected, and certain core physical processes are expressed as cumulative numerical modifiers rather than causal transformations.

The direction for 05 is therefore **a redesign of the simulation architecture and the player-facing game flow**, not a reduction in simulation scope.

The objective is to preserve the **connected chain of systems** that already works well in concept: **vineyard and harvest → wine potential/anchors → characteristics and taste → evolving winemaking processes → post-bottling development → wine cellar and commercial management**. Characteristics and flavor descriptions already exist at harvest, but must continue to be recalculated as the same wine develops; this chain is not a one-time sequence of disconnected stat changes.

The emerging central thesis is:

> **The vineyard establishes a wine's possibilities. Anchors express those possibilities. Physical winemaking processes transform the wine through time. Sensory characteristics and flavors emerge from its current state. A unified, moving-target evaluation assesses the result, while a separate commercial layer determines its value and market opportunities.**

This can preserve the depth and distinctive identity of Winemaker04 while giving the system cleaner code, more predictable behavior, better opportunities for balancing, and a considerably stronger player experience.

There are two equally important redesign tracks:

1. **Simulation:** establish a causal, consistent flow from vineyard and harvest to fermentation, extraction, maturation, bottle evolution, sensory profile, and evaluation.
2. **Player experience:** rethink how the winery, cellar, batches, completed wines, tastings, equipment, inventory, aging, pricing, and contracts are presented and managed. This is not merely a visual redesign; it requires rethinking calculations, decisions, information architecture, and available management tools.

The existing commercial mechanics are broadly seen as successful and should be retained where possible, but the presentation and management experience surrounding them should be reconsidered substantially.

---

## 2. The actual architecture of Winemaker04

### 2.1. Several connected models, not one unified wine model

The code analysis identified these major mechanical layers:

- **Wine Anchors:** 12 underlying values representing inherited potential, origin, development, and processing history.
- **Six Wine Characteristics:** acidity, aroma, body, spice, sweetness, and tannins.
- **Structure Index:** evaluates how well those six characteristics fit their moving, context-dependent ideal ranges.
- **Taste Profile:** 14 flavor families derived from characteristics, anchors, grape identity, and wine features; an additional 26 tasting descriptors are derived for presentation.
- **Taste Quality Index:** a second moving-target evaluation of the 14 families.
- **Wine Score:** the arithmetic mean of Structure Index and Taste Quality Index.
- **Land Value Modifier:** a vineyard-derived index involved in harvest characteristics/anchors and, separately, commercial pricing.
- **Wine Features:** a further system for triggered, accumulating, and evolving properties, including faults and positive developments.
- **Commercial layer:** estimated value, prestige, buyer behavior, contracts, and selling.

The implemented final quality formula is:

\[
\text{Wine Score}=\frac{\text{Structure Index}+\text{Taste Quality Index}}{2}
\]

Both Structure Index and Taste Quality Index are on a 0–1 scale. The same six characteristics can influence both indices, and anchors can influence both through separate routes. This produces depth, but also overlapping effects and difficult-to-trace causality.

### 2.2. Lifecycle: vineyard to bottle

The main lifecycle implemented by `WineBatch.state` is relatively short:

```text
Vineyard conditions + grape variety
              |
              v
          HARVEST
    -> grapes (batch created)
    -> initial anchors, characteristics, features, scores
              |
              v
       CRUSHING / PRESSING
    -> must_ready
    -> characteristic changes, anchor changes, juice yield, risks
              |
              v
      FERMENTATION SETUP
    -> must_fermenting
    -> setup anchors, process options, risks
              |
              v
       WEEKLY FERMENTATION
    -> cumulative changes to characteristics and anchors
              |
              v
           BOTTLING
    -> bottled
    -> bottling snapshots, bottle inventory
              |
              v
       BOTTLE AGING / SALES
    -> further developments, revised prices, contracts, prestige
```

The only persisted lifecycle states defined in the relevant type are:

- `grapes`
- `must_ready`
- `must_fermenting`
- `bottled`

There is **no distinct pre-bottling barrel-aging state** in this lifecycle. There is equipment and storage-vessel management, but its material and quality attributes are not yet fully integrated into wine development.

**Important 05 distinction:** These four persisted strings are an observation about 04, **not** a lifecycle schema to carry into 05. A maturing/aging phase may require explicit representation, or a smaller set of persistent facts may allow current activity and readiness to be calculated from physical state, vessel assignment, process configuration and history. What should persist, what should be derived, and what deserves a named phase remain open. This question belongs to the unified time/development-engine redesign, not to a simple addition of a fifth enum value.

Harvest, crushing, and fermentation setup involve staff/work activities; fermentation subsequently evolves at weekly game ticks; bottling captures historical score snapshots while bottled inventory can continue changing.

### 2.3. Harvest: origin produces the initial batch

At harvest, the game creates a wine batch using grape-specific defaults and vineyard-specific conditions. Relevant inputs include:

- Grape variety and color
- Regional/grape suitability
- Soil, aspect, altitude, and region
- Ripeness at harvest
- Land Value Modifier
- Vineyard condition, density, and overgrowth
- Other grape and vineyard metadata
- Pending or event-triggered wine features

The implementation invokes `computeHarvestWineAnchors()` to create anchors and `modifyHarvestCharacteristics()` to modify the grape's six base characteristics. It then constructs anchor-adjusted structural target ranges, calculates Structure Index, processes harvest-related features, calculates Taste Quality Index, and estimates price.

The vineyard does not simply assign an initial numerical quality rating: it helps establish both **what the grapes are like now** and **what the wine has potential to become**.

Harvest activity can be partial over multiple ticks. Successive parts of the same harvest batch are combined by quantity-weighted averaging of the six characteristics and of anchors. Land Value Modifier is also averaged. The merged batch's indices are recalculated.

### 2.4. The 12 anchors currently used (04 reference, not 05 specification)

| Anchor | General role in 04 |
|---|---|
| `sugarPotential` | Potential for sugar-related expression |
| `acidPotential` | Potential for acidity |
| `phenolicPotential` | Tannin/phenolic potential |
| `aromaticPotential` | Aromatic potential |
| `bodyPotential` | Potential for body/richness |
| `terroirExpression` | Strength of vineyard/site expression |
| `extractionState` | Accumulated extraction-related state |
| `fermentationState` | Accumulated fermentation-related state |
| `leesState` | Yeast/lees-related development |
| `oxidationPressure` | Oxidative susceptibility and pressure |
| `maturationState` | Accumulated maturation-related development |
| `processFootprint` | Overall footprint of processing/features |

In the current design, anchors are intended to be **upstream** of the six characteristics and taste. Wine characteristics and scores should not feed back into the origin anchor calculation.

Anchors affect the resulting wine through several distinct pathways:

1. **Modifier scaling.** An operation that would ordinarily change a characteristic is scaled by an anchor-derived capacity. A high-potential wine can respond differently to an identical intervention.
2. **Moving structural targets.** Anchors change the width and midpoint of acceptable ranges used by Structure Index.
3. **Direct flavor derivation.** The taste-profile layer uses anchors alongside the characteristics; e.g., lees and maturation can produce flavor effects even without a comparably large characteristic change.
4. **Further anchor updates.** Crushing, fermentation setup, weekly fermentation, and features can change several anchor values, altering future responses.

For positive characteristic modifiers, the anchor bridge uses an approximately linear multiplier:

\[
\Delta C_{\text{actual}}=\Delta C_{\text{base}}\times[1+0.52(A-0.5)]
\]

Here, \(A\) is a derived anchor capacity for that characteristic (bounded before application). Negative modifiers use a different anchor-derived penalty scale.

**Strength of the concept:** A winemaking operation can work differently on different wines because each wine has its own origin and potential. That is a core mechanic to preserve.

**Architectural weakness:** The anchor object mixes inherited/limited *potential* with mutable *state and development*. `sugarPotential` and `acidPotential` conceptually differ from `fermentationState`, `maturationState`, and `processFootprint`. The new version should distinguish these responsibilities. The provisional vocabulary is **Raw Material Anchors** for what the harvest makes possible and **Processing Anchors / Development State** for what treatment has made possible, available, or actually realized. Whether the latter should be called anchors at all is unresolved. **The number 12 and the existing names are not locked.**

### 2.5. Six wine characteristics

The **current** six variables are (a good starting point for 05, but not a fixed final count, naming scheme, or membership):

1. Acidity
2. Aroma
3. Body
4. Spice
5. Sweetness
6. Tannins

They start with grape-specific base values. Examples from the examined implementation:

| Characteristic | Pinot Noir | Chardonnay | Primitivo |
|---|---:|---:|---:|
| Acidity | 0.65 | 0.40 | 0.50 |
| Aroma | 0.60 | 0.65 | 0.70 |
| Body | 0.35 | 0.75 | 0.70 |
| Spice | 0.50 | 0.50 | 0.50 |
| Sweetness | 0.50 | 0.50 | 0.70 |
| Tannins | 0.40 | 0.35 | 0.70 |

The harvest system adjusts these values based on the vineyard and ripeness; subsequent operations modify the current values rather than recomputing them from the grape baseline. The process is therefore path-dependent.

An identical body increase may improve a light Pinot Noir while making an already full-bodied Primitivo excessively heavy. **Higher values are not universally better**. The point is to develop a coherent profile relative to the wine's starting material and intended style.

### 2.6. Structure Index and the moving target

Structure Index evaluates the six-characteristic vector against preferred ranges and interactions.

In 04, this is built from:

- **Base ranges**, e.g. acidity 0.40–0.60, body 0.40–0.80.
- **Anchor-driven range adjustments**, which shift and widen/narrow preferred targets.
- **Characteristic-driven range adjustments**, so e.g. tannins, body, aroma, acidity, and sweetness can alter one another's preferred ranges.
- **Additional explicit penalty and synergy rules**, based on characteristic combinations.

The central score resembles:

\[
\text{Structure Index}=\max(0,1-2\overline{D})
\]

where \(\overline{D}\) is the average adjusted distance from the target midpoints. Distance outside the accepted range receives extra penalty. Thus being within a range does not guarantee the maximum score: closeness to the target still matters.

The rule set separately handles, for instance, high tannins with insufficient body, heavy body with weak aroma, and positive combinations of high acidity and tannins. This is expressive, but it partly duplicates the moving-target system: a mismatch can be represented both by a shifted preferred range and an extra penalty multiplier.

**Key shared conclusion:** The moving target is one of the most distinctive, central mechanics in Winemaker. It should remain. The redundant synergy/penalty approach should probably be substantially simplified or absorbed into target construction, while retaining explicit faults as a different concept.

A caveat for 05: the moving targets must have constraints. If an extreme characteristic always moves the ideal ranges enough to excuse itself, the evaluator can become too forgiving, inadvertently favoring exaggerated wines. Target shifts need bounded, biologically and stylistically sensible behavior.

### 2.7. Taste: 14 families and 26 descriptors

The 04 taste-profile engine derives **14 flavor families**:

`flower`, `citrus`, `treeFruit`, `tropicalFruit`, `redFruit`, `blackFruit`, `driedFruit`, `spiceFlavor`, `vegetable`, `earth`, `microbial`, `oakAging`, `generalAging`, and `faults`.

The families are calculated from the six characteristics, anchors, grape identity, and active features. Example relationships include:

- Acidity and acid potential contribute to citrus.
- Aroma and aromatic potential contribute to floral expression.
- Body, tannins, phenolic potential, and extraction contribute to darker fruit expression in reds.
- Lees and fermentation state contribute to yeast/microbial notes.
- Maturation and bottle aging contribute to mature/aged flavor families.
- Fault features contribute to the faults family.

These values are normalized using a sigmoid-like function. The system also derives **26 more specific descriptors** such as grapefruit, green apple, pear, dark fruit, honeyed notes, oak/toast, leather/tobacco, and mineral expression. These descriptors are currently presentation-level outputs rather than independently scored values.

Taste Quality Index then evaluates the 14 families against weighted moving targets. Targets depend on red versus white wine, grape variety, and dependencies between flavor families. For example, high red-fruit expression can change preferred amounts of black fruit, dried fruit, spice, and tropical fruit.

\[
\text{Taste Quality Index}=\frac{\sum_i w_i s_i}{\sum_i w_i}
\]

where \(s_i\) is the fit of a family to its contextual target and \(w_i\) its weight.

**Current architectural inconsistency:** Structure Index and Taste Quality Index implement similar moving-target evaluation concepts using somewhat different scoring frameworks. In 05, they should share a common evaluation framework even if their actual target profiles, number of dimensions, weightings, and importance differ. **The current set of 14 families and 26 descriptors is not final.** What survives is the concept of a **parallel taste system beside the structural system**, sharing the same moving-target engine while serving potentially different gameplay and presentation purposes.

**Desired gameplay emphasis:** The flavor families and detailed descriptors are valuable primarily as a rich wine-identity and tasting presentation, appealing to players who enjoy wine tasting. They need not have a central 50% role in determining overall quality. That exact weighting remains undecided.

### 2.8. The wine feature system

Seven registered features were found:

- Oxidation
- Green Flavors
- Stuck Fermentation
- Terroir Expression
- Bottle Aging
- Noble Rot
- Grey Rot

The framework supports three broad behaviors: **triggered**, **accumulation**, and **evolving**. Features can appear probabilistically, accumulate risk, change severity, modify characteristics and anchors, influence estimated price or buyers' sensitivities, and cause prestige effects.

The most compelling gameplay concepts include:

- Harvesting early can produce green-flavor risk.
- Pressing choices can change exposure to faults.
- Fermentation choices can create risks or favorable developments.
- Noble Rot can become a desirable feature, but waiting increases the danger of Grey Rot.
- Oxidation risk evolves with time and batch state.
- Bottle aging produces further sensory and market development.

**But the implementation is not one coherent physical-development engine.** Features add effects to the wine in a separate layer; some effects are direct stat changes rather than outcomes of a physical process. A key example is Stuck Fermentation, currently represented by an event/feature that directly raises perceived sweetness and lowers body, rather than arising from yeast activity stopping while fermentable sugar remains.

Another nuance: configured `effects.quality` numbers in individual feature definitions are not necessarily applied as direct additions/subtractions to the live Taste Quality Index. The live scoring path derives taste quality from flavor families. Features influence it via characteristics, anchors, and flavors; configured quality effects are also used in reporting and risk previews. Descriptions can therefore imply more direct effects than the live scoring calculation provides.

### 2.9. Crushing and pressing: a useful multichannel mechanic

Crushing is a strong example of the current game's potential. Player choices include pressing method, pressing intensity, destemming, and cold soak.

These choices can affect:

- Juice quantity/yield
- Six wine characteristics
- Extraction/phenolic/process anchors
- Staff work and processing cost
- Feature and fault exposure
- Future fermentation and taste results

The volume/yield calculation includes:

\[
\text{Yield Multiplier}=0.85+0.30p
\]

where \(p\) is pressing intensity on 0–1. Thus very gentle pressing yields roughly 85% of the baseline, mid-intensity yields 100%, and high-intensity yields 115%.

The game therefore already contains an economically meaningful trade-off: more juice versus the risk of overly aggressive extraction or less desirable characteristics.

However, the crushing calculation produces an additional `qualityPenalty` that is discarded in the actual activity completion path (`void qualityPenalty`). Quality changes instead come through other applied pathways. That is an example of configuration and conceptual intent diverging from actual runtime behavior.

### 2.10. Fermentation: currently cumulative, not transformative

In 04, the player chooses a fermentation method (`Basic`, `Temperature Controlled`, or `Extended Maceration`) and temperature (`Ambient`, `Cool`, or `Warm`).

Setup updates the relevant process anchors and can trigger risks. Each subsequent weekly game tick applies further characteristic and anchor changes while the batch remains in `must_fermenting`.

For example, Extended Maceration adds these nominal, pre-anchor-scaling characteristic changes per week:

| Characteristic | Weekly change |
|---|---:|
| Tannins | +0.008 |
| Body | +0.010 |
| Spice | +0.006 |
| Aroma | +0.007 |

Warm temperature adds another +0.006 body, +0.004 tannins, and −0.002 acidity per week.

The cumulative design makes time matter, but there is no governing sugar-to-alcohol conversion model that controls when fermentation is actually complete. The six-characteristic sweetness value is not consumed as fermentable sugar. Normal weekly fermentation does not use `fermentationProgress` as a meaningful physical completion threshold, and the player can bottle once the wine is in `must_fermenting` without completing a minimum fermentation duration.

This enables a type of mathematical optimization: leave a wine fermenting as long as the cumulative modifiers are favorable, then bottle before they become unfavorable or risks accumulate too much.

**05 should replace this with time-dependent transformations:** fermentation should have a genuine progression, depletion of available substrates, changing activity, possible interruption, and a natural endpoint or progression toward one.

### 2.11. Storage and bottle aging: an unconnected pair of systems

The storage-vessel system has relatively rich data: material, type, quality, condition, fill history, cleanliness, capacity, age, occupancy, and maintenance status. Batches must be assigned sufficient physical storage capacity.

However, the storage vessel's material and quality do not currently participate in the sensory simulation in the expected way. Oak versus stainless steel does not itself produce oak influence, change oxidative development, or modify maturation kinetics.

This is especially important because the taste model already contains `oakAging` and the anchors already contain maturation and lees-related values. There is a natural missing connection from **vessel properties → wine-development environment → changing physical/sensory state**.

Bottle aging is more developed. The game tracks elapsed bottled weeks, calculates grape-specific maturity progress, and grows an aging feature that can modify acidity, aroma, spice, sweetness, and body. It can also carry a significant market premium.

One limitation: the age curve principally approaches a plateau; labels such as “past peak” exist, but there is not a robust intrinsic rise–peak–decline model. Wine can still deteriorate through accumulated oxidation risk.

### 2.12. Commercial mechanics are comparatively successful

The current estimated bottle price is approximately:

\[
\begin{aligned}
P ={}& (\text{Wine Score}\times\text{Base Rate}) \\
&\times\text{Score Curve Multiplier}\\
&\times\text{Land Value Price Multiplier}\\
&\times\text{Feature Price Multiplier}\\
&\times\text{Company Prestige Multiplier}\\
&\times\text{Vineyard Prestige Multiplier}
\end{aligned}
\]

Land Value Modifier is based chiefly on normalized land value and vineyard prestige, adjusted for overgrowth and planting density. It influences wine development at harvest and market value downstream.

Customer order logic recalculates value using the wine's current properties and prestige, rather than always relying on the price originally stored in the batch. Asking price and customer characteristics affect bids, purchase likelihood, and quantity. Contracts can require minimum taste or structure scores, specific characteristics, grape varieties, regions, age, or vineyard properties.

These mechanics make the game's objectives more interesting than maximizing a generic score. An exceptional but atypical wine, a reliable everyday wine, and a prestigious origin wine can plausibly occupy different market niches.

**Shared direction:** Preserve the basic commercial/value/contract system and its strategic depth. Redesign how the player experiences and manages the finished wines and commercial portfolio.

### 2.13. State coupling and code-level issues to correct

Specific findings from code inspection include:

- Feature and fermentation updates can be scheduled concurrently in weekly ticks while modifying overlapping characteristics, anchors, and indices. A later consistency pass helps, but the update path still merits deterministic consolidation.
- Feature recalculation removes previously applied feature effects from stored characteristics by inspecting effect descriptions, then reapplies them. This is fragile compared with deriving sensory effects from an authoritative physical state.
- Pressing `qualityPenalty` is calculated but unused in the actual completion path.
- Oxidation configuration contains pressing-related `riskModifiers`, but the general event-trigger path does not visibly apply them as accumulation-style event modifiers; weekly oxidation risk is implemented elsewhere.
- Normal fermentation is not governed by actual progress to completion.
- Storage-vessel properties are not wired into maturation/taste transformations.
- Configured feature quality bonuses/penalties and actual live taste scoring do not always follow the intuitive direct path suggested by their names.
- Distinct paths sometimes store indices, recalculate them, and separately display the live recomputed score, increasing opportunities for stale derived values.

These are **code-trace findings**, not all reproduced runtime bugs. The discussion reviewed repository implementation and tests, including harvest-to-bottle lifecycle and score/pricing tests, but did not execute the application end to end.

---

## 3. The design philosophy for Winemaker05

The overarching aim is to preserve the scope and distinctive choices of 04 while establishing cleaner boundaries between concepts.

### 3.1. Proposed model: preserve the conceptual game flow, rebuild the boundaries

The intended 05 flow is not a list of disconnected systems. The value of 04 is that vineyard decisions lead to wine properties, those properties constrain production choices, and the resulting wine can develop further before and after bottling and ultimately has commercial consequences.

```text
VINEYARD & HARVEST
  | grape variety, site, ripeness, vineyard condition, harvest decisions
  |
  +--> RAW MATERIAL POTENTIAL / ANCHORS
  |      what the starting material can become; capacities and limitations
  |
  +--> INITIAL WINE STATE / SENSORY EXPRESSION
         characteristics and taste already visible at harvest
                       |
                       v
       GENUINE WINE-DEVELOPMENT ENGINE
       physical state + time + actions + risks + actual vessel environment
         |               |               |
         | extraction    | fermentation  | maturation / oxidation / lees
         |_______________|_______________|
                       |
          state continuously transformed
                       |
                       v
         CURRENT SENSORY EXPRESSION
         structural characteristics + parallel flavor/taste profile
                       |
                       v
         SHARED MOVING-TARGET EVALUATOR
         Structure Index / Taste evaluation (distinct configurations)
                       |
                       v
      BOTTLING + CONTINUED BOTTLE DEVELOPMENT
         closure, storage, time, wine's remaining potential
                       |
                       v
      WINE CELLAR — CENTRAL MANAGEMENT EXPERIENCE
         production lots, maturity, tasting, inventory,
         valuation, release decisions, contracts and sales
```

**Commercial Origin Prestige is a separate price-and-demand input**. It comes from the vineyard's commercial standing and can contribute to the value of the wine without being interchangeable with agricultural potential or sensory quality.

This is a conceptual map, not a rigid linear implementation. Fermentation and extraction can overlap; evaluation can be performed at harvest, during fermentation, during maturation, and after bottling. **The wine is repeatedly evaluated from its evolving state**. A current stage or descriptive label need not always be a permanently stored enum.

The 05 code should make five responsibilities explicit:

1. **Origin:** vineyard, grape, harvest, and the inherited capacities of the raw material.
2. **Development:** the changing material and process state over time, with equipment and storage as genuine inputs.
3. **Sensory expression:** the current structure and taste profiles derived from that state.
4. **Evaluation:** shared moving-target calculations applied separately to structure and taste, plus fault assessments as needed.
5. **Commercial management:** price, reputation, contracts, cellar inventory, and strategic decisions.

**Proposed invariant:** A score evaluates wine; it does not modify wine. A winemaking decision transforms physical/development state; it does not directly edit the score. Sensory profiles can be calculated repeatedly from current conditions without becoming separate competing sources of truth.

### 3.2. Two different concepts currently called anchors

The anchor principle is **agreed as central**: each harvest inherits potential from its vineyard, variety, and growing conditions, and that potential shapes or limits the outcomes of later winemaking. However, 04 currently calls at least two conceptually distinct categories by one name.

#### A. Raw Material Anchors — inherited winemaking potential

These describe the properties and limits established by the grapes, vineyard and harvest: for example potential sugar, acid, extractable phenolics, aromatic precursors, and suitability for certain development pathways. They make identical techniques behave differently on different wines.

They should generally be **persistent reference capacities**, although the amount of a resource that remains available can diminish, and potential can degrade. They should not become an endlessly accumulating score multiplier.

A high-phenolic-potential batch, for example, may contain more material available for extraction. A player can choose prolonged maceration, but the effect should depend on what is still extractable. After enough extraction, further time has diminishing returns.

#### B. Processing Anchors / Development State — what has happened or is happening

In 04, fields such as `extractionState`, `fermentationState`, `leesState`, `oxidationPressure`, `maturationState`, and `processFootprint` reflect treatment and development rather than the original raw material. These should be separated from inherited capacities.

**Processing Anchors** is a possible working name, but it may be misleading if we are actually talking about measurable physical quantities, current process progress, and environmental exposure. **Development State**, **Process State**, or **Transformation State** may ultimately be more precise. The architecture should be designed before naming that second collection definitively.

The second category could include values such as residual sugar, alcohol, yeast activity, extraction already achieved, remaining extractable material, oxygen exposure, maturation progress, and oak-derived compounds. The exact variables and level of physical fidelity remain open.

| Question | Raw Material Anchors | Processing Anchors / Development State |
|---|---|---|
| Where do they originate? | Vineyard, grapes and harvest | Player choices, equipment, vessel conditions, time and events |
| What do they describe? | Possibility, capacity and constraints | Conversion, exposure, achieved development and current conditions |
| How do they change? | Often stable baseline; remaining potential may be consumed or degraded | Change through actual transformations and environmental conditions |
| How do they affect the wine? | Limit or shape possible reactions | Determine what the wine has actually become |
| What does the player see? | Interpreted potential and advanced diagnostics | Progress, current condition, developing risks, changes and forecasts |

**No commitment is being made to preserve all 12 existing anchors.** Some may be renamed, combined, removed, split, or represented as physical state instead of anchors. Likewise, new variables may be needed. The critical mechanic to preserve is **origin-dependent potential governing treatment-dependent outcomes**, not the current twelve-field interface.

The player need not see raw values by default. “Strong extraction potential,” “delicate aromatics,” and “suitable for long maturation” can communicate capacity, with deeper numerical inspection available for enthusiasts.

### 3.3. Replace Land Value Modifier with two clearly named concepts

The current **Land Value Modifier** should not survive as one player-facing concept. The agreed direction is to separate the winemaking consequences of a vineyard from its independent commercial reputation.

| New player-facing concept | Role in 05 | Main downstream influence |
|---|---|---|
| **Terroir Potential** | Agricultural and viticultural quality/capacity established through site, grape, and harvest conditions | Initial raw-material anchors and the wine's achievable development |
| **Origin Prestige** | Commercial standing, recognition, designation and perceived pedigree of the vineyard/origin | Selling price, demand and buyer/contract interest |

These are the selected **working names** for the split, replacing *Land Value Modifier* in player-facing explanations. Their exact backend variable names and formulas can be designed later; the conceptual separation and the name **Origin Prestige** should be carried forward, not described as a still-open naming exercise.

This retains an important incremental reward: acquiring land in a prestigious region should feel economically powerful. Origin Prestige creates a direct market advantage even before the player has perfected their winemaking.

At the same time, Terroir Potential means an obscure or inexpensive site can produce exceptional raw material if its agricultural properties are genuinely good. Conversely, a famous origin may command a premium even for a merely competent wine. High-quality wine and high-prestige origins should correlate where appropriate but not collapse into a single number.

The practical distinction is **two possible routes to success: buy recognition, or develop a reputation by making excellent wine**. Existing company prestige and evolving vineyard reputation will need clear positioning relative to Origin Prestige so that market bonuses do not inadvertently count the same reputation several times.

### 3.4. One moving-target framework, two parallel sensory systems

The agreement is to keep the **idea of a structural system and a parallel taste system**, rather than commit to all of their existing dimensions, implementation details, or their current score weighting.

**Structure:** the current six axes—acidity, aroma, body, spice, sweetness and tannins—work well as a starting point. The six-characteristic framework and the moving Structure Index are among the strongest mechanics in 04. Yet the final set is **not locked to precisely six**, and any dimension can be renamed, redefined or replaced if a better model emerges.

**Taste:** a parallel flavor/taste representation should remain. The current 14 flavor families and 26 tasting descriptors have strong potential for a sophisticated, nerdy wine-tasting presentation, but their number, identity, relationships and scoring importance are **very much open to change**.

**Uniformity means sharing the evaluator, not forcing both profiles to look alike.** The same engine should support a six-dimensional structure vector and a different-sized taste vector with different target profiles, target dependencies, ranges, weights and presentation outputs.

A common evaluator would accept:

- A profile vector of any supported dimensions (current structure or taste).
- Target ranges and weights for each dimension.
- Context such as grape, color, origin, intended style and other relevant wine properties.
- A bounded set of rules for how target ranges shift in response to the context or other dimensions.
- A consistent scoring function and detailed explanatory output.

It would return overall fit, per-dimension contributions, current dynamic ranges, and reasons for each shift. The **Taste Quality Index need not remain 50% of Wine Score** simply because the two systems share an engine. Its future role—as overall quality component, style fit, typicity, buyer preference, or some combination—remains open.

The useful conceptual distinctions remain:

- **Quality:** how well made, coherent and balanced the wine is.
- **Style/identity:** what the wine tastes and feels like.
- **Typicity:** how closely it fits established expectations for its grape, origin or target style.

A wine can be excellent and atypical. Different buyers can value familiar typicity and unusual identity differently. No final formula for combining these concepts has been selected.

### 3.5. The moving target should do most of the work of synergies and penalties

The moving-target system and the explicit rule-based penalties/synergies presently overlap. If high tannins require more body, moving the preferred body range may already model the mismatch; an additional separate penalty is often redundant.

The direction is to absorb most **structural interactions** into the moving target rather than maintaining multiple competing quality adjustments.

Nevertheless, wine faults should remain conceptually distinct. Excess tannin relative to body is an imbalance; a seriously oxidized wine is a physical fault with its own sensory and commercial consequences. We should not force every harmful condition into a relative balance target.

**Not yet decided:** whether any separate synergy/penalty rules survive, the precise target-shift rules, or how much typicity affects quality versus market preference.

---

## 4. A genuine wine-development engine: fermentation, maturation, storage and bottle evolution

This is **not merely a future improvement to fermentation**. It is one of the central architectural transitions from 04 to 05. The existing evolving-feature mechanics suggest an ambition to simulate time-dependent wine development, but the current implementation is a series of overlapping additive characteristics, anchor changes, feature triggers, and aging bonuses. The new version should model the **continuing transformation of the wine itself**.

### 4.1. Unifying principle: one developing wine, many interacting processes

A wine batch should carry one coherent **authoritative physical/development state** through harvest, preparation, fermentation, maturation, bottling and post-bottle evolution. Each player intervention and each passage of game time acts on that state. The structure and taste systems continually interpret what the wine currently is.

The new model should allow processes to interact rather than behave as isolated switches:

- Fermentation consumes sugar and develops alcohol, which may influence extraction and perceived body/sweetness.
- Extraction depends on what compounds the grapes contain, what has already been extracted, and the actual temperature/contact conditions.
- Oxidation depends on exposure, vessel/closure behavior, oxygen uptake, time and the wine's susceptibility; it can alter flavor, color, maturity and risk.
- Maturation depends on chemical development, the wine's potential, storage conditions, vessels, lees and oxygen availability; it may integrate, enhance, stabilize or eventually degrade a wine.
- Bottling changes the physical storage environment but **does not stop time-dependent development**. Bottle maturation is a continuation of the wine's history under different conditions.

The precise chemistry need not be exhaustive. This is a game model with carefully chosen causal variables, not a laboratory simulation. But the rules should produce consequences that make intuitive winemaking sense and can be explained to the player.

### 4.2. Uniform input/output contract for transformations

Every time-dependent process should operate through a common interface even when the internal mathematics differ:

```text
DEVELOP WINE (one simulation interval)

Inputs
  Current authoritative wine state
  Raw Material Anchors / inherited limits
  Process configuration and player actions
  Actual vessel and storage environment
  Elapsed time (with substeps if required)
  Explicit random seed / event context

Outputs
  Updated authoritative wine state
  Updated material quantities, process progress and availability
  Newly emerging conditions, faults and opportunities
  Traceable reasons for material changes
  Possible warnings, forecasts and completion/readiness information
```

A single coordinating engine should apply its sub-processes in a defined, testable order, or solve interacting effects together where necessary, and **commit one consolidated batch update**. This prevents the current situation where weekly fermentation and feature systems can independently overwrite overlapping batch fields.

The common contract should make it possible to simulate one week, preview the next week, compare alternative actions, and later change the time step without rewriting the purpose of each process. The game may continue to use weekly ticks, but rate calculations should explicitly include elapsed time rather than assuming every effect is a one-off weekly bonus.

### 4.3. Raw potential, achieved development and remaining capacity

The two anchor categories are essential to this engine. Consider extraction:

```text
Raw Material Anchor: phenolic potential available at harvest
                   |
                   v
Current extraction conditions: skins + temperature + contact time
                   |
                   v
Physical transformation: material transfers into wine
                   |
                   +--> less extractable material remains
                   +--> more extracted phenolic compounds in wine
                   +--> future extraction rate changes
                   |
                   v
Derived sensory result: tannins, body, texture, possibly flavor
                   |
                   v
Moving structure/taste evaluation of the new wine
```

This is **transformative**, not `+0.008 tannins` every week forever. The amount achieved should depend on the capacity inherited from harvest and the path already taken.

The engine needs to decide which properties are true measurable/abstract material state, which are stable capacities and which are derived sensory interpretations. Candidate physical variables—not a final list—include fermentable sugar, alcohol, viable yeast activity, extracted and remaining phenolics, precursor/aromatic compounds, cumulative oxygen exposure, relevant maturation compounds and faults/contamination levels.

### 4.4. Fermentation must have real progression and possible failure

In 04, *Basic*, *Temperature Controlled* and *Extended Maceration*, plus ambient/cool/warm temperature, produce useful choices but generally express their effect through cumulative characteristics and anchors. In 05 they should become differences in the physical processes.

A plausible conceptual sequence is:

1. Harvest establishes initial fermentable sugar and other raw-material capacities.
2. The player chooses fermentation configuration, temperature management, yeast/handling where supported, and actual vessel.
3. Each time interval transforms some available sugar into alcohol according to the wine's conditions and yeast activity.
4. Heat, stress, equipment, exposure and available substrates influence the rate and risks.
5. Fermentation naturally approaches completion as substrate is depleted, or it may slow or stall before completion.
6. The resulting residual sugar, alcohol and developed compounds are interpreted by the sensory and evaluation layers.

A stuck fermentation should therefore **arise when conversion stops while sugar remains**. It should not be an independent random feature whose implementation simply adds sensory sweetness. An operation such as temperature control should act on temperature and fermentation reliability; its quality benefit follows from the resulting wine.

The present six-axis **sweetness** value should not be equated with physical sugar content. It is an interpreted sensory characteristic, potentially influenced by sugar, acidity, alcohol and other context.

Maceration/extraction may coexist with fermentation. This is another reason not to force all development into a single mutually exclusive `must_fermenting` stage.

### 4.5. Extraction, crushing and pressing should change material, not just stats

The existing pressing trade-off between juice yield and character is worth keeping. In 05, processing decisions should affect the material balance and downstream conditions: how much liquid is obtained, what is extracted, what remains in solids, oxygen exposure and potentially the juice's susceptibility to later problems.

Extraction should be finite, selective and responsive to method, skin contact, temperature, alcohol and time. As extractable material is depleted, further maceration has diminishing returns. Both volume and sensory consequences should be generated through the same physical transformations, rather than separate direct changes to score.

The code-level `qualityPenalty` currently computed but discarded during crushing is an example of an implementation that should not be reproduced. Quality should follow from the resulting wine and its evaluation—not a processing step assigning an arbitrary quality subtraction unless a genuine defect is separately modeled.

### 4.6. Maturation must be coupled to actual vessels and storage

This is a major missing connection in 04. Vessel inventory already tracks type, material, quality, condition, age, capacity and history. In 05 these are not merely logistics data: they should influence the **environmental inputs** to the wine-development engine.

Examples of potential causal paths (illustrative, not agreed formulas):

| Vessel/storage property | Relevant process effect | Potential sensory/management outcome |
|---|---|---|
| Oak barrel material and previous use | Oak compound extraction; oxygen transmission | Oak-derived flavors, integration, maturation possibilities |
| Stainless-steel tank | Low oxygen transfer when properly managed; controllable conditions | Preservation of fresher expression; different maturity trajectory |
| Concrete vessel | Different thermal/oxygen behavior depending on design | Different maturation environment and style |
| Vessel size and fill level | Surface-to-volume, headspace, oxygen exposure | Different development speeds and oxidation risk |
| Vessel condition and maintenance | Leakage, contamination or poor sealing | Higher physical risk; maintenance has practical value |
| Temperature control and cellar climate | Speed and reliability of reactions | Trade-offs in aging time, development and risk |
| Time spent on lees | Lees contact and associated development | Texture/body/flavor effects where appropriate |

These should not become simplistic rules such as “oak barrel gives +0.04 Aroma each week.” A barrel may help some wines and harm others, depending on origin potential, current state and desired style. The same vessel should also have operational consequences: capacity, occupancy, maintenance, cost and its opportunity cost for alternative batches.

Vessel allocation therefore becomes a meaningful management decision. Wine development and equipment management must interact through one authoritative state and process context.

### 4.7. One maturation model across pre-bottle and post-bottle wine

Pre-bottle maturation and bottle aging should belong to a **continuous development framework**, even if their physical environments and available actions differ.

For example:

```text
Fermentation finishing or complete
     |
     v
Wine held/maturing in tank, barrel, concrete, etc.
     |    actual vessel changes oxygen, temperature, oak/lees contact
     |    development engine advances with elapsed time
     |
     +--> optional transfer, blending, further maturation, bottling choice
     |
     v
BOTTLING — changes containment, closure and inventory form
     |
     v
Bottled wine continuing to evolve in cellar storage
          closure + storage conditions + prior wine state + time
          maturation, drinking window, risk and eventual decline
```

Bottling is a consequential operation, but it should not create an unrelated second aging engine or reset a wine's developmental history. Development before bottling shapes what is possible after bottling. A robust model should permit early improvement, an attractive window and eventual decline or changing style—rather than maturity merely accumulating to a permanent positive plateau.

A forecast of peak maturity can be approximate, and the player should have reasons to hold or release wine, including uncertainty, cash flow, storage capacity, rising price and deterioration risk.

### 4.8. Features and risks become consequences of development

The old feature system contains valuable scenarios worth preserving: Green Flavors, Stuck Fermentation, Oxidation, Noble Rot, Grey Rot, Terroir Expression and Bottle Aging. The question is **how they arise and operate**, not whether these ideas have gameplay value.

A new development/risk framework could express:

- **Oxidation** as the accumulation and effects of oxygen exposure in the specific storage/processing environment.
- **Stuck fermentation** as insufficient yeast activity relative to remaining fermentable sugar.
- **Green character** as a possible result of vineyard/harvest ripeness and processing, expressed through actual sensory state.
- **Noble Rot versus Grey Rot** as a vineyard/harvest time-and-risk trade-off with a positive possibility and a worsening loss hazard—not purely a later cellar feature.
- **Aging-related flavor development** as a consequence of maturity state, temperature, exposure and vessel/closure conditions.

Features could survive as **observed conditions, milestones, alerts, diagnoses, player-facing badges or event labels**, while their underlying mechanisms move into the real wine-development model. That preserves the interesting recognizable storytelling without retaining a separate generic stat-modifier system.

Risks can retain randomness where appropriate, but probability should be conditional on state and environment, with testable/reproducible outcomes where possible.

### 4.9. Rethink lifecycle state instead of extending 04's four-state enum

The 04 `WineBatch.state` values—`grapes`, `must_ready`, `must_fermenting`, `bottled`—are clearly not sufficient to describe the proposed 05 model. **They should not be imported unchanged into 05.** But simply adding `maturing` or `aging` might reproduce the same architectural problem.

The key design question is whether *what the material is*, *what is happening to it*, *where it is*, and *what the player can do next* should be modeled as separate dimensions.

A possible design separates:

| Dimension | Examples | Why it may be needed |
|---|---|---|
| **Material/inventory form** | Grapes, must, bulk wine, bottles | Physical quantity, inventory, possible operations |
| **Active processes** | Fermenting, macerating, maturing, stabilizing; potentially concurrent | Physical kinetics and player control |
| **Process progress / physical facts** | Remaining sugar, alcohol, yeast activity, extraction progress | Determines what is actually complete or possible |
| **Storage context** | Assigned vessel, closure, location, environmental conditions | Makes equipment genuinely consequential |
| **Computed operational status** | Ready for pressing, fermentation stalled, suitable for bottling, approaching maturity | Explains available choices without duplicating state |
| **Historical events** | Harvested, pressed, transferred, bottled, blended | Provenance, irreversibility, audits and explanations |

This is only a **candidate decomposition**, not a settled data schema. Two plausible implementations remain open:

- Persist explicit, minimal physical forms/process states alongside authoritative material state and event history.
- Persist fewer high-level stages and derive much of a batch's status/available actions from state, process configuration and events.

A distinction should be made between a **display label** (“Maturing in oak”), a **simulation fact** (the wine is in vessel X at temperature Y and has certain compounds), and a **legal or physical transition** (it was bottled, so transfer/maceration actions are no longer available). Not everything needs a stored enum; not everything can be calculated solely from a score either.

This decision is part of designing the maturation engine and the authoritative batch model, not an isolated UI or enum cleanup.

### 4.10. Deterministic progression, forecasts and management consequences

One coherent time engine should advance the developing wine for a known interval, coordinate interacting processes, record results and derive sensory/evaluation updates afterward. Given the same starting state, elapsed time, actions, conditions and random seed, it should reproduce the same outcome.

This underpins a useful player experience: the game can show why a wine changed, estimate risks and maturity, allow alternative vessel/timing choices to be compared, and connect every week of storage occupancy to production and financial consequences.

The development engine should be designed to support **both pre-bottle processing and post-bottle wine-cellar management**. Its outputs should directly supply the cellar's maturity outlook, alerts, readiness decisions, tasting trends, opportunity costs and commercial release decisions. Without that connection it would be another deep calculation hidden from gameplay.

### 4.11. Still open: how much physical detail?

The discussion has **not** settled the exact chemistry, time-step granularity, equations, process list, state vector, random-risk implementation, or whether all processes should be recomputed from full history. Nor is there a commitment to make fermentation, aging and processing fully realistic at any cost. The objective is a coherent simulation that produces varied, interpretable and enjoyable decisions rather than needlessly detailed chemistry.

## 5. Evaluation should remain separate from development

The new architecture should make the separation explicit:

```text
PHYSICAL STATE
    |
    v
DERIVED SENSORY PROFILE
    |- Six characteristics
    |- Flavor families
    |- Tasting descriptors
    |
    v
EVALUATION
    |- Structural coherence / moving target
    |- Optional taste-family fit / typicity
    |- Fault and condition assessment
    |
    v
COMMERCIAL INTERPRETATION
    |- Quality
    |- Style and customer fit
    |- Origin reputation
    |- Age, inventory and market conditions
    |- Price and contract eligibility
```

This should prevent operations from modifying indices directly. It also creates a clearer causal explanation for changes: “Four weeks in this cask changed the wine's oxygen exposure and maturation state, which softened perceived acidity and developed oak/aged notes,” rather than “Oak barrel +0.03 Aroma, +0.04 Quality.”

A mature wine's **character** should be allowed to change even when its overall quality does not monotonically improve. The player should sometimes prefer a younger style or a deliberately unusual style.

Similarly, market value must not be treated as identical to quality. Origin reputation, customer preference, volume, contract requirements, and the available portfolio matter.

---

## 6. The wine cellar should become the central management experience

This is a **central 05 design concept**, not a secondary UI suggestion. The vineyard creates potential, winery actions transform it, and the cellar is where the player most clearly encounters **the wine they have made**: its identity, development, weaknesses, maturity, available quantity, commercial possibilities and its place in the winery portfolio.

In 04, cellar and sales views are largely successful as inventory, price and contract tools. Yet they do not fully convey wine as a developing product with a history or provide the management depth that the new wine-development engine enables. The redesign concerns **data, calculations, decisions and gameplay flow as much as presentation**.

### 6.1. Three functions within the central cellar experience

**Production and maturation management.** Which lots are fermenting, completing fermentation, resting, maturing or bottled? In which vessel? Which processes are active? What has changed this week? What is urgent, what intervention is available, and which equipment or capacity is being occupied?

**Wine assessment and identity.** What has this wine become? How well does its structure fit its moving targets? Which flavors, tasting descriptors and faults emerge? How do its current properties compare with its origin potential? Is it improving, stable or deteriorating? What might it become if the player changes the vessel or waits another season?

**Commercial portfolio management.** Which wines should be bottled now, kept for maturation, released to market, allocated to contracts or sold immediately? How does a new vintage fit the winery's portfolio? What is the trade-off between expected future quality/price and storage costs, liquidity and risk?

The cellar should make these three areas feel like a connected management activity rather than different pages displaying unrelated numbers.

### 6.2. Manage physical lots, vessels, bottled wines and commercial identities

A central conceptual unit could be a **wine lot** that persists through several physical forms and can be associated with a vineyard, grape, vintage and production history. The detailed identity design is still open: wine lot, batch, vessel allocation, bottle inventory and marketed label/vintage might need distinct records.

The cellar should be able to represent:

- Harvested material and must awaiting processing or fermentation.
- Wines actively fermenting and wines maturing in one or more vessels.
- Actual vessel occupancy, environment, maintenance and capacity conflicts.
- Bottled wines and their ongoing post-bottle development.
- Stocks reserved for customers, contracts, future releases or sale.

A player may need actions such as tasting/inspecting, switching vessel, managing time on lees, bottling, blending or splitting lots, comparing styles or vintages, reserving inventory and adjusting release/pricing strategy. **These are possible management tools, not all confirmed implementation commitments.** Their feasibility and usefulness should be considered while designing the underlying state and simulation.

The important shift is from “here are rows of batches and bottles” toward “here are the wines under my care, their constraints, their development, and the decisions I can make about them.”

### 6.3. Preserve the concrete Pinot Noir · 2029 wine-detail concept

The earlier discussion included an **illustrative finished-wine presentation** intended to show how 05 might communicate a recognizable wine first, with numerical detail available underneath. That example should remain part of the design reference:

```text
┌─────────────────────────────────────────────────────────────┐
│ [Wine bottle / label artwork]                              │
│                                                             │
│ PINOT NOIR · 2029                                           │
│ Willamette Valley · Estate Reserve                          │
│                                                             │
│ Status: Approaching maturity                                │
│                                                             │
│ STRUCTURE                 BOTTLES IN CELLAR                 │
│    86 / 100                      1,280                      │
│                                                             │
│ TASTING PROFILE                                             │
│ [Red cherry] [Violet] [Earthy] [Light oak]                  │
│                                                             │
│ Elegant, aromatic and medium-bodied with fresh acidity     │
│ and softening tannins.                                      │
│                                                             │
│ CELLAR OUTLOOK                                              │
│ Current maturity: Developing                                │
│ [██████████████████░░░░░░░░]                                │
│                                                             │
│ Expected drinking window: within the next 1–3 years.       │
│ Continued aging may improve integration, but oxidation     │
│ risk rises over time.                                       │
│                                                             │
│ Inspect structure · Taste details · Maturation history      │
│ Compare lots · Plan release · Price / contracts             │
└─────────────────────────────────────────────────────────────┘
```

**All values, classifications, forecasts and descriptors in this example are invented solely to demonstrate the intended presentation.** Nothing above is evidence of the current simulation's outputs. The point is to make a wine feel like **a product with its own identity and history**, not merely a numerical score.

The profile should work at multiple levels:

1. **At a glance:** name, origin, vintage, bottle/lot identity, condition, style and readiness.
2. **Wine enthusiast:** six (or revised) structural characteristics with moving targets; flavor-family visualization; descriptors; faults, identity and typicity.
3. **Winemaker/manager:** physical development and treatment history, current vessel or storage, potential, readiness, risks and forecast.
4. **Commercial:** inventory, origin prestige, price, customer fit, allocation, release, orders and contracts.

This particular card is a **design example**, not an instruction to make the final cellar interface a static card layout. A graphical wine-cellar scene and panel-heavy management views may coexist.

### 6.4. Wine maturity and cellar outlook must be simulation outputs

The illustrative “Approaching maturity” status and drinking window are useful only if the development model can justify them. The new engine should support calculating or estimating:

- Current trajectory: developing, at an appealing window, stable, declining or at risk.
- Likely consequences of keeping the wine longer, with uncertainty where appropriate.
- Environmental and vessel contributions to the trajectory.
- What was actually gained or lost since a previous tasting.
- Whether the wine is in a suitable state for bottling/release.
- Opportunity costs: inventory value, cash flow, vessel occupancy and holding risks.

This is a significant gameplay requirement. It may affect the state model, storage data, simulation diagnostics, price forecasts and commercial UI, not just the appearance of a maturity bar.

### 6.5. Show causes, history and trade-offs

The player's explanation should follow the same chain as the engine:

```text
Harvest: high aromatic potential, moderate phenolic potential
     -> Gentle pressing: lower yield, more delicate extraction
     -> Controlled fermentation: sugar converted successfully
     -> Barrel maturation: oak influence + oxygen exposure
     -> Bottled and held: growing maturity, changing aroma
     -> Current profile: elegant, softening, still developing
     -> Commercial decision: sell now or accept holding risk
```

Players should be able to understand changes without needing to inspect raw code or arbitrary effect lists. The detailed data can remain accessible for enthusiasts. A wine-tasting description is a first-class result of the simulation, while the full process history remains available as an explanation of **why** the wine became that way.

### 6.6. Cellar overview: a working management dashboard, not just inventory

At the portfolio level, a useful cellar should draw attention to **decisions**. Possible sections or filters include wines needing intervention, actively developing lots, wines approaching a desirable release window, maturing inventory with meaningful upside, vulnerable/at-risk wines, commitments and contracts, and vessel/capacity bottlenecks.

An integrated view could allow the player to see: a fermentation approaching its endpoint, two casks that differ in oxygen exposure, a Pinot Noir nearing a desirable drinking window, a contract requiring a specific quality/style and a short-term cash shortage. Those are not separate mini-games: they are competing decisions involving the same production and commercial resources.

Blending and lot splitting could eventually make the cellar more strategic. The existing weighted-average combination of partial harvests provides a precedent, but any deliberate blending in 05 would need rules for combining **full material states**, not simply averaging finished characteristic scores. This remains an open feature.

### 6.7. Preserve the working commercial systems, redesign their player-facing connection

The established sales, pricing, customers and contracts provide a useful base. The intention is **not** to replace them automatically. They should receive reliable inputs from the new wine evaluation and Origin Prestige, and their output should become part of the cellar's management tools.

The new player experience should make clear that a wine can be very good but commercially difficult, distinctive but sought after by a niche buyer, or highly saleable because of its prestigious origin. The player should be making portfolio choices, not simply sorting an inventory by a single score.

**Design principle:** The new wine cellar is the point where the player's vineyard, production, aging, quality, style, equipment, finance and sales choices all become legible and actionable.

## 7. Preserve commercial strategy without making every wine chase the same score

The game should reward more than one business model and winemaking approach.

A premium vineyard can provide an incremental prestige advantage, but should not be a strict prerequisite for excellent wine. A lesser-known vineyard can succeed through careful production and good market positioning.

A strong wine score should matter, but should not be the only objective. Contracts, customer preferences, requested characteristics, identity and typicity, maturation windows, quantity, and price should all potentially create distinct incentives.

A high-quality unusual wine could find a niche market. A reliable inexpensive wine could succeed through volume and consistency. A prestigious wine might earn a premium because of its origin, independent of perfect sensory quality.

The goal is to let the player **choose what wine to make and whom to sell it to**, not simply maximize Structure Index or Wine Score in every batch.

A delicate Pinot Noir, powerful Tempranillo, aromatic Sauvignon Blanc, and late-harvest Chardonnay should create different production and commercial challenges rather than being pushed toward the same ideal six-characteristic vector.

---

## 8. Core engineering principles for the 05 implementation

### 8.1. Authoritative versus derived state — including lifecycle

The first technical design task should be to define what the batch *actually stores* and which outputs are calculated from it. **Do not carry forward the four 04 lifecycle states as the assumed 05 persistence model.** A wine should be able to mature before bottling, develop afterward, and potentially undergo more than one active process. A current status might be computed from physical state and process history rather than stored as a single mutually exclusive enum.

A leading proposal is to persist:

- Origin and provenance
- Anchor/potential information
- Current authoritative physical/development state
- Storage/vessel and process context
- Events and processing history
- Inventory, ownership, and commercial commitments

Then consistently derive or cache:

- Operational labels such as “maturing”, “fermentation stalled”, “ready to bottle” and relevant available actions when these follow from state
- Current sensory characteristics (starting with the existing six)
- Flavor families and descriptors
- Structure and other evaluation scores
- Interpretable maturity/condition information
- Estimated price and contract-relevant properties

Caching may be useful for performance, but it should not create multiple conflicting sources of truth. A cached score is not authoritative over the state that produced it.

### 8.2. Unified transformation interface

Different process modules should share the same conceptual type of input and output. Rather than each module updating arbitrary fields of `WineBatch`, they should act through a common transformation contract. **This includes the entire pre-bottling and post-bottling maturation path**, not just the fermentation phase. Vessel assignment and environment must enter the same model that generates physical and sensory changes.

The detailed order and composition of weekly sub-processes should be explicit. For example, fermentation and oxidation may interact, but neither should independently persist an outdated copy over the other's changes.

### 8.3. Determinism, testing, and traceability

Given the same initial batch, player choices, environmental inputs, elapsed time, and random seed/events, the simulation should produce the same result.

This allows:

- Repeatable test scenarios
- Meaningful side-by-side comparisons of process choices
- Regression tests across future balancing changes
- Debugging that explains why a score changed
- Confidence that UI previews and committed game results use the same rules

### 8.4. Clean conceptual boundaries

The most important boundaries are:

- **Potential is not current process state.**
- **Physical sugar is not perceived sweetness.**
- **A sensory characteristic is not a quality score.**
- **A wine fault is not merely a structural imbalance.**
- **Taste description is not necessarily taste quality.**
- **Commercial reputation is not the same as agricultural potential.**
- **The player-facing estimate is not necessarily the authoritative underlying state.**

Clarifying these boundaries should simplify both the simulation and the user interface.

---

## 9. Retain, rebuild, and reconsider

The table keeps the original 12 comparison topics, adds a decision-status column, and includes the additional implementation decisions previously listed separately. The counts and fields in the 04 implementation remain reference points, not requirements for 05.

| Existing concept | Direction for the next iteration | Status and open detail |
|---|---|---|
| Vineyard characteristics | Preserve and refine | Vineyard, grape, ripeness, and harvest remain sources of potential and player choices; exact relationships are open. |
| Wine anchors | Preserve concept, rebuild implementation | Separate inherited Raw Material Anchors from mutable development/process state. The 04 count of 12 is not required; fields and the mutable side's name remain open. |
| Land Value Modifier | Separate agricultural potential from commercial prestige | The player-facing concepts Terroir Potential and Origin Prestige are agreed. Formulas and their relationship to existing vineyard/company prestige remain open. |
| Six characteristics | Preserve as core sensory/structural variables | Use the current six as a starting point; final number, definitions, and names remain open. |
| Moving Structure Index | Preserve as central scoring principle | Contextual moving targets are agreed in principle; dimensions and exact rules remain open. |
| Taste families and descriptors | Preserve, but emphasize wine identity and presentation | Keep a parallel taste profile under the same configurable moving-target framework as structure. The 14 families and 26 descriptors are not fixed. |
| Taste Quality Index | Unify evaluation framework; reconsider scoring weight | The role of taste fit in any overall Wine Score remains open. |
| Synergy/penalty rules | Mostly incorporate into moving target calculations | Strong direction; identify any exceptional rules that remain and keep physical faults distinct from structural imbalance. |
| Feature system | Replace behavior with unified development and risk simulation | Retain useful risk/reward scenarios, but connect their causes to wine development; exact representation remains open. |
| Fermentation | Rebuild as a transformative, time-dependent process | Model physical sugar-to-alcohol progression, yeast activity, and possible stalls. Equations and kinetics remain open. |
| Maturation/storage | Connect equipment and vessel attributes to actual wine evolution | Vessel and environment effects should matter. Include pre-bottle maturation and continued post-bottle development; mechanics and parameters remain open. |
| Sales and contracts | Retain core mechanics, redesign presentation and management | Preserve the broad pricing, customer, contract, and sales foundation; adapt its inputs to the 05 wine model and Origin Prestige. |
| Extraction and maceration | Model material changes and trade-offs | Finite material, depletion, and kinetics are a proposed approach; exact mechanics remain open. |
| Lifecycle persistence | Rethink rather than copy 04's four persisted states | Separate material form, active processes, physical facts/history, and derived readiness as needed. The 05 persistence model remains open. |
| Wine Score and evaluation | Keep development separate from structural fit, taste fit, style, and typicity | This is a proposed model; the final formula and the role of each assessment remain open. |
| Wine cellar and Pinot Noir · 2029 example | Make the cellar central to production, aging, assessment, and commercial decisions | The management priority and example are agreed; the card's invented values are illustrative, while exact tools and interactions remain open. |
| Lot splitting, blending, and comparison | Consider as cellar capabilities | Open feature design; blending should operate on material state, not just average finished scores. |

Preserve the interacting game systems, not the precise 04 representation of their variables or lifecycle states.

## 10. Open questions for the design phase

These topics have been raised but should **not** be treated as settled decisions:

### Wine identity and anchors

- Which (if any) of the 12 original anchors survive as **Raw Material Anchors**, and which should instead become **Development/Processing State**? The number 12 is not a requirement.
- Are some anchors genuinely fixed at harvest, while others represent diminishing reservoirs or potential that may degrade?
- Should the second category be called Processing Anchors, Development State, or something else? The conceptual split is agreed; naming the mutable side is not.
- What are the exact mathematical relationships among site, grape, harvest choices, and inherited potential?
- Which original six structural characteristics should remain, be renamed, or be added to/removed?
- What should the revised flavor-family and tasting-descriptor taxonomy contain? Neither 14 families nor 26 descriptors is mandated.

### Transformation system

- Which physical variables are necessary for a strategically rich but manageable fermentation model?
- How are fermentation rate, completion, stuck fermentation, and alcohol modeled?
- How should pre-fermentation extraction, fermentation with skin contact, pressing, and post-fermentation maturation interact?
- Which effects should be deterministic, and which should have stochastic components?
- How do oak, steel, concrete, vessel age, material, fill history, condition, and temperature translate into development?
- How should one development engine support pre-bottling maturation, bottling, continued bottle evolution, and eventual decline?
- Which facts and process statuses should be persisted, and which should be derived? Should maturity or readiness be calculated rather than treated as a single stored stage?
- Which operations are reversible, limited by resources, or permanently transformative?

### Evaluation

- What is the new meaning of “quality”? Is it mainly structure, structure plus flavor fit, or several separate assessments? **One evaluation engine for the parallel structure and taste systems is agreed**, but their numbers of axes and contributions need not match.
- Does Taste Quality Index retain any direct weight in Wine Score?
- What is the role of grape typicity versus style/identity versus quality?
- How much can one characteristic shift another's ideal range before targets become too forgiving?
- Which explicit synergies or penalties, if any, remain outside target construction?
- How are actual faults evaluated separately from structural balance?

### Economy and vineyard identity

- How should **Terroir Potential** and **Origin Prestige** be calculated and displayed now that their conceptual separation and player-facing working names are established?
- How closely should expensive land correlate with potential quality?
- How does vineyard reputation grow independently of fixed land attributes?
- How do buyers respond to style, typicity, maturity, rarity, and brand compared with quality and origin?
- Which existing sales/contract calculations can remain unchanged, and which need updated inputs?

### Cellar and gameplay

- What is the primary management unit: harvest batch, physical lot, vessel allocation, label/vintage, bottled SKU, or some combination?
- Can lots be split, combined, blended, moved, or aged in multiple vessels?
- What should players see immediately versus in advanced diagnostic views?
- How are wine histories, tasting profiles, drinking windows, forecasts, and risk explanations presented?
- What should the player be able to do directly from the cellar overview?
- How do the winery scenes, cellar management panels, inventory lists, and sales/contract workflows connect?

---

## 11. Recommended order of design work

The discussion ended with a clear priority: **do not begin by implementing fermentation as an isolated new subsystem**. The old batch state model, anchor container and score paths would constrain it in precisely the wrong ways. The authoritative model and the development contract should come first.

A coherent design order is:

1. **Define the 05 wine/lot state model and lifecycle semantics.** Decide what is persisted versus derived, how inventory/material form differs from active process and readiness, and how to represent pre-bottle maturation without copying the 04 four-state enum.
2. **Define the two origin concepts.** Establish **Terroir Potential** for agricultural capacity and **Origin Prestige** for commercial premium, along with their relation to existing company/vineyard prestige.
3. **Define the raw-material anchor vocabulary.** Determine what harvest establishes, what potential can be consumed or degraded, and which existing “anchors” instead belong in physical/development state. Do **not** start from a commitment to 12 values.
4. **Define a minimal authoritative physical state.** Identify the material variables needed for causal fermentation, extraction, maturation, oxygen behavior and later bottle evolution.
5. **Define the sensory projection.** Specify how current state yields initial and evolving structural characteristics and the parallel taste/flavor system. Use 04's six characteristics and existing families as prototypes, not permanent requirements.
6. **Design one moving-target evaluation engine.** Support structural and taste profiles with different dimensionalities, ranges, weights and contextual rules. Keep evaluation separate from the underlying transformations.
7. **Define the uniform development contract and tick ordering.** Processes use common state/time/environment/action inputs and produce consolidated, traceable updates, with controlled randomness where required.
8. **Prototype actual processing and maturation.** Start with harvest/extraction/fermentation, then include maturing in real vessels, faults/risks, bottling and continued bottle evolution through the same architecture.
9. **Make equipment and storage causal.** Link materials, conditions, capacity, fill history and environmental factors to development and wine-cellar decisions, not just inventory logistics.
10. **Design the cellar as the central management experience in parallel.** Work from the **Pinot Noir · 2029** example outward: individual wine identity, maturity forecast, lots/vessels, actionable alerts, inventory, pricing and release/contract workflows. UI design should help determine which outputs and decisions the engine must expose.
11. **Reconnect the existing commercial systems.** Preserve pricing, customers, contracts and sales where possible while taking their quality, identity, age, supply and Origin Prestige inputs from the redesigned model.
12. **Create scenario and regression tests.** Test path dependence, material constraints, transformation stability, maturation trajectories, structure/taste moving targets and market results with deterministic input scenarios.

This is a **recommended design sequence**, not a fixed development roadmap. In particular, the wine-cellar experience must inform simulation design before all engine code is finished; otherwise a technically sophisticated engine may provide too few usable choices for the player.

## 12. The intended game experience

The vision is not to turn Winemaker into a laboratory simulator, nor to remove the detailed system that makes it interesting.

The game should allow a player to inherit the possibilities of their vineyard, make consequential decisions at harvest and through the winemaking process, and watch a genuinely evolving product emerge. The player should be able to recognize the wine's character, judge its balance, understand its development, decide how to position it commercially, and choose when to sell or age it further.

The strongest strategic tension lies in **potential versus intervention, quality versus style, development versus risk, and quality versus commercial value**.

A delicate Pinot Noir, full-bodied Tempranillo, aromatic Sauvignon Blanc, and late-harvest Chardonnay should not be variants of the same numeric optimization puzzle. Their material properties and constraints should lead to different production decisions and different market opportunities.

The game should support players who want to pursue exceptional wines, but also those who prefer reliable commercial production or niche styles. There is a meaningful incremental reward in purchasing prestigious vineyards, but careful winemaking and good positioning should provide other paths to success.

**Working design statement for Winemaker05:**

> Winemaker is a wine-production and business simulation in which every wine begins with a distinct inherited potential, develops through a coherent series of physical and time-dependent transformations, acquires a recognizable structural and sensory identity, and creates value through the player's decisions about production, maturation, positioning, and sale. Quality is contextual rather than simply additive; greater intensity is not automatically better, and the best decision depends on the wine, its potential, its intended style, and the market.

---

## 13. Code references from the 04 investigation

The following are **source-code references** used in the discussion, not just design documentation. They provide the starting point for verifying and replacing the current mechanics.

**Batch creation and process flow**

- [Wine batch and vineyard type definitions](https://github.com/gram12321/winemaker04/blob/main/src/lib/types/types.ts)
- [Inventory service — harvest creation, batch combination, process preview](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/winery/inventoryService.ts)
- [Vineyard manager — ripeness, yield, partial harvesting](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/vineyard/vineyardManager.ts)
- [Crushing completion and work calculation](https://github.com/gram12321/winemaker04/blob/main/src/lib/features/activities/services/workcalculators/crushingWorkCalculator.ts)
- [Fermentation setup and work calculation](https://github.com/gram12321/winemaker04/blob/main/src/lib/features/activities/services/workcalculators/fermentationWorkCalculator.ts)
- [Fermentation manager — weekly effects and bottling](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/winery/fermentationManager.ts)
- [Weekly game tick and update ordering](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/core/gameTick.ts)

**Anchors, characteristics, and evaluation**

- [Wine anchor creation and resolution](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/anchors/wineAnchorService.ts)
- [Anchor updates during crushing, fermentation, and feature development](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/anchors/wineAnchorProcess.ts)
- [Anchor–characteristic bridge and range adjustments](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/anchors/wineAnchorCharacteristicBridge.ts)
- [Grape base characteristics and balanced ranges](https://github.com/gram12321/winemaker04/blob/main/src/lib/constants/grapeConstants.ts)
- [Harvest characteristic modifications](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/characteristics/harvestCharacteristics.ts)
- [Crushing characteristic modifications](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/characteristics/crushingCharacteristics.ts)
- [Fermentation characteristic modifications](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/characteristics/fermentationCharacteristics.ts)
- [Structure Index calculation](https://github.com/gram12321/winemaker04/blob/main/src/lib/wineStructure/calculations/structureIndexCalculator.ts)
- [Dynamic structure range adjustments](https://github.com/gram12321/winemaker04/blob/main/src/lib/wineStructure/calculations/rangeCalculator.ts)
- [Structural penalty/synergy rules](https://github.com/gram12321/winemaker04/blob/main/src/lib/wineStructure/config/rules.ts)
- [Taste flavor and descriptor derivation](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/taste/wineTasteProfileService.ts)
- [Taste Quality Index and family targets](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/taste/tasteQualityIndexService.ts)
- [Wine Score and estimated-price calculation](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/winescore/wineScoreCalculation.ts)
- [Land Value Modifier](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/winescore/landValueModifierCalculation.ts)

**Features, storage, aging, and commerce**

- [Feature engine — events, accumulation, evolution and effects](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/featureService.ts)
- [Registered feature configurations](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/constants/commonFeaturesUtil.ts)
- [Oxidation configuration](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/constants/oxidation.ts)
- [Noble Rot configuration](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/constants/nobleRot.ts)
- [Grey Rot configuration](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/constants/greyRot.ts)
- [Bottle Aging configuration](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/constants/bottleAging.ts)
- [Storage vessel types and attributes](https://github.com/gram12321/winemaker04/blob/main/src/lib/types/storageVessels.ts)
- [Storage vessel allocation and capacity](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/winery/storageVesselAllocationService.ts)
- [Aging status and progression](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/wine/features/agingService.ts)
- [Contract eligibility and validation](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/sales/contractService.ts)
- [Customer order generation](https://github.com/gram12321/winemaker04/blob/main/src/lib/services/sales/generateOrder.ts)
- [Bottling log and historical score snapshots](https://github.com/gram12321/winemaker04/blob/main/src/lib/features/wineLog/services/wineLogService.ts)

**Selected tests examined**

- [Harvest-to-bottle lifecycle](https://github.com/gram12321/winemaker04/blob/main/tests/wine/wineryLifecycle.test.ts)
- [Taste Quality Index](https://github.com/gram12321/winemaker04/blob/main/tests/wine/tasteQualityIndexService.test.ts)
- [Aging and pricing](https://github.com/gram12321/winemaker04/blob/main/tests/wine/agingAndPricing.test.ts)

---

## 14. Current design status and next decision

As of 13 November 2026, the direction and its open details are summarized in §9; the outstanding design questions are listed in §10. This overview records design direction and supporting 04 findings, not a frozen implementation specification.

**Highest-priority next task:** Define the authoritative 05 wine/lot state model and its relationship to Raw Material Anchors, Development State, sensory projections, evaluation, vessel/storage conditions, lifecycle semantics, and commercial value. Design it alongside an initial central-cellar workflow, using the retained Pinot Noir · 2029 example, so the simulation exposes decisions players can act on.
