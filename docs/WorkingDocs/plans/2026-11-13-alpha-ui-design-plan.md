# Winemaker05 Alpha UI Design Plan

**Status:** Approved alpha UI direction, scope, and intended stack. Exact scene compositions, panel dimensions, and the PixiJS version remain open.
**Date:** 13 November 2026
**Goal:** Define a navigable alpha player interface that presents Winemaker05 as a 2.5D winery world with placeholder scenes and panels.
**Scope:** Shared shell, scene and panel map, navigation, placeholder interactions, and delivery slices. This UI design does not specify time or alert behavior.
**Constraints:** No application or simulation implementation exists yet. The alpha needs no game data or persistence. Do not copy Winemaker04 data, formulas, lifecycle states, or UI mockup values as 05 facts.
**Architecture:** Use React/HTML/CSS for shell navigation and panels, with a PixiJS canvas for layered, fixed-composition 2.5D scenes. The alpha demonstrates navigation and presentation only; scene and panel content remains placeholder material until the 05 simulation and persistence are available.
**Files:** This plan; approved presentation direction in [design.md](../design.md); source concepts in [Winemaker05_UI_Visual_Concepts.md](../Winemaker05_UI_Visual_Concepts.md). Future application source paths depend on stack selection.
**Verification:** Check document links, decision-status wording, claims against the transition overview, and whitespace. No application checks are available before a stack exists.

## 1. Scope and design basis

This plan combines the approved Winemaker05 simulation direction with the scene, panel, and interaction ideas collected in [Winemaker05 UI and Visual Concepts](../Winemaker05_UI_Visual_Concepts.md). The [transition overview](../Winemaker04_to_05_Transition_Overview.md) remains the source for simulation rationale and open design questions.

### Approved presentation direction

- The player interface uses a **2.5D world view organized into scenes**, supported by detailed panels, lists, and charts.
- Alpha scenes, panels, and content use placeholders; game data and fixture-backed simulation are not required.
- The cellar remains the central wine-management destination. The prototype starts at Estate; it does not save a last destination or player preferences.
- The intended alpha stack is TypeScript, Vite, and React for the application shell, with PixiJS for layered, fixed-composition 2.5D scenes. The design does not require a freely rotating 3D camera or dynamic lighting. Pin the PixiJS version when scaffolding begins.
- Primary navigation has five destinations: Estate, Winery, Cellar, Company, and Management. Management groups Finance, Contracts/Market, Equipment, and People/Work; contextual links may open a specific management panel directly.
- Use scene-specific camera compositions with consistent selection and panel conventions. Scene selection opens or highlights a placeholder detail view; lists provide another route to the same content. Do not use drag-and-drop.
- The main shell includes a hideable Activity Manager, presented as a sidebar or overlay, and a top bar with a calendar and an Advance Time button. Their operational behavior, time rules, and alerts are outside this UI design.
- Company is more dashboard-like than Winemaker04. High-score or achievement areas and statue/landmark imagery may inspire placeholder modules, without importing 04 scoring or progression rules.
- Focused wine details may use modal patterns from Winemaker04 as visual and interaction references, adapted to 05 concepts.
- The initial layout targets desktop landscape, using approximately 1280×720 as a prototype baseline; mobile is deferred.

### Approved simulation direction the UI must preserve

- Vineyard and harvest establish **Terroir Potential** and Raw Material Anchors. Keep Terroir Potential distinct from **Origin Prestige**, which is a commercial reputation concept.
- Keep inherited raw-material potential separate from mutable development/process state. The final name and exact fields for the mutable state remain open.
- Show the evolving wine as physical development produces sensory expression. Keep structure and taste as parallel evaluations using a shared configurable moving-target framework.
- Evaluation is derived from wine state; scores do not transform the wine. Show commercial value and market fit separately from sensory quality.
- Development may continue before and after bottling. Do not assume Winemaker04's four-stage lifecycle or make a proposed maturity label authoritative.
- The cellar connects production and maturation, wine assessment, inventory, release decisions, contracts, and sales.
- Existing sales, pricing, customer, and contract ideas are a useful base, but their 05 inputs and mechanics remain subject to the redesign.

### What this plan proposes

The approved alpha is a navigation and placeholder prototype, not a simulation walkthrough. Finance, contracts, equipment, people/work, and research may appear as placeholder panels; their presence does not approve underlying simulation systems or rules.

## 2. Functional alpha definition

For this plan, a **functional UI alpha** means:

1. The player can navigate the main destinations and open the Management placeholder panels.
2. The player can select placeholder scene objects or list entries and open/close their placeholder detail panels or a focused wine-detail modal.
3. The Activity Manager can be shown and hidden from the main shell; its exact sidebar/overlay layout remains to be wireframed.
4. The top bar shows a calendar placeholder and an Advance Time button. Their behavior is not specified in this UI design.
5. The interface uses no game dataset, simulated state changes, or persistence. Prototype view preferences reset when the prototype restarts.

This alpha validates navigation, information hierarchy, scene composition, and panel/modal use. It does not implement gameplay actions, simulation data, time advancement, alerts, finance, contracts, equipment effects, staff productivity, or market calculations.

## 3. Shared shell and layout proposal

Use one consistent shell for scene views and panel-heavy management views. The scene and panels should share selection and navigation context rather than behave as separate applications.

~~~text
┌─────────────────────────────────────────────────────────────────────┐
│ Calendar · Advance Time · Activity Manager toggle                  │
├──────────────┬───────────────────────────────┬──────────────────────┤
│ Main         │                               │ Placeholder detail   │
│ navigation   │  2.5D scene or panel workspace│ panel or modal        │
│              │  + optional placeholder list  │                       │
│              │                               │                       │
├──────────────┴───────────────────────────────┴──────────────────────┤
│ Optional placeholder footer / contextual navigation                │
└─────────────────────────────────────────────────────────────────────┘
~~~

The exact panel positions and whether the Activity Manager docks or overlays the scene should be tested in wireframes. Its shell toggle remains available in either layout. The layout must preserve enough scene area to read spatial context while keeping detailed panels usable.

### Shared behavior

- **Navigation:** persistent primary destinations for Estate, Winery, Cellar, Company, and Management. Management exposes Finance, Contracts/Market, Equipment, and People/Work placeholder panels.
- **Calendar and time control:** show a calendar placeholder and an Advance Time button in the top bar. Time advancement behavior and alert handling are explicitly outside this UI design.
- **Activity Manager:** provide a shell control to show or hide its placeholder sidebar/overlay. Its visibility is temporary and resets to the default on restart.
- **Selection:** scene clicks and placeholder lists can select or highlight a placeholder object and open its detail panel. Lists provide a precise alternative to clicking scene art. No game state is changed.
- **Details:** use panels for general placeholder details and allow focused wine details to use a modal pattern inspired by Winemaker04. Adapt the presentation to 05 terminology and keep 04 mechanics and values out.
- **Functionality boundary:** no game-data fixtures, simulated gameplay actions, alert/event UI, or persistent player preferences are part of this alpha.
- **Accessibility:** keyboard-accessible navigation, panels, modal close behavior, and Activity Manager toggle accompany scene interaction. Selection and status cannot rely on color or animation alone.

## 4. Primary destinations and responsibilities

| Destination | Presentation and role | Alpha design focus |
|---|---|---|
| **Estate / Vineyard** | Elevated 2.5D estate scene with placeholder parcels, buildings, and paths. Use a scene-specific camera composition. | Establish the estate layout and selection affordances; use empty or abstract placeholders instead of populated game data. |
| **Winery / Production** | 2.5D production floor or readable cutaway with placeholder vessels and work areas. | Establish a distinct interior composition. Scene selections and any list route open placeholder details only. |
| **Cellar** | Central wine-management destination, with a cellar scene or shelf/cask layout and placeholder inventory structure. | Establish the cellar scene and wine-detail panel/modal layout. Wine concepts and Pinot Noir · 2029 may guide labels, but no wine data or mechanics are needed. |
| **Company** | Dashboard-like view with cards, summaries, and optional portfolio/location visualization. | Use placeholder modules for company overview, high scores/achievements, and statue/landmark-inspired presentation. Do not imply adopted 04 scores, values, awards, or progression rules. |
| **Management: Finance** | Panel-first placeholder under Management. | Establish the layout only; no ledger, numbers, accounting behavior, or purchase/sale flow. |
| **Management: Contracts / Market** | Panel-first placeholder under Management. | Establish navigation and a placeholder detail layout only; no buyer, contract, market data, or allocation behavior. |
| **Management: Equipment** | Panel-first placeholder, optionally with a winery image or selected-object preview. | Establish catalog/detail layout only; no items, values, comparison rules, or purchase behavior. |
| **Management: People / Work** | Panel-first placeholder under Management. | Establish roster/task layout only; no staff data, assignments, or work behavior. |
| **Research / Growth** | Not required for the alpha navigation scope. | May be reconsidered after core scene and panel layouts are established; do not imply a research tree or progression rules. |

### Initial landing recommendation

**Agreed:** the prototype opens at Estate by default, with Cellar directly reachable from global navigation. It does not persist the last destination or other player preferences.

## 5. Information model and presentation rules

For the alpha, scenes, panels, and lists use visual placeholders without a game-data source. Future UI work can connect to authoritative 05 read models and actions once those exist; that connection is outside this UI alpha plan.

Keep the following information visibly distinct when available:

1. **Identity and origin:** grape, vintage, estate/parcel, lot or bottle identity, and material history. Final identity and lot boundaries remain open.
2. **Raw Material Potential:** inherited capacity and limits established by origin and harvest. Do not show it as achieved wine quality.
3. **Development / process state:** what has happened or is happening through time, actions, vessel, and storage. The mutable-state term and its physical variables remain open.
4. **Sensory expression:** current structural characteristics and taste/flavor profile derived from the wine's current physical state.
5. **Evaluation:** structure and taste results, target context, and explanatory contributions when exposed by the evaluator. Do not assume a fixed number of dimensions, descriptors, weights, or a single combined score.
6. **Condition and maturity:** readiness or drinking-window language only when supported by the simulation. Distinguish current observation from a forecast.
7. **Commercial context:** Origin Prestige, inventory, buyer fit, commitments, prices, and expected proceeds belong to commercial presentation and must not be presented as sensory quality.

Placeholder labels may indicate where future information belongs, but the prototype does not need synthetic values. Generated image text and values are visual references only; do not copy them as 05 names, currencies, data, or formulas.

## 6. Core navigation walkthrough for the alpha

### A. Estate to winery to cellar

1. Open Estate and move through its placeholder scene and parcel list.
2. Select a placeholder parcel and open or close its detail panel.
3. Navigate to Winery and Cellar from the persistent shell; inspect their distinct placeholder scenes and detail layouts.
4. Open a focused wine-detail modal from Cellar and close it without losing the underlying navigation context.

### B. Main shell and Activity Manager

1. Use global navigation to open each destination and Management sub-panel.
2. Show and hide the Activity Manager from its shell control.
3. Confirm that calendar and Advance Time controls are visible, with no UI-defined time or alert behavior.

### C. Company dashboard

1. Open Company from the primary navigation.
2. Review placeholder dashboard modules, including space for high-score/achievement and statue/landmark-inspired content.
3. Confirm that the page reads as a dashboard rather than requiring a populated world map or company dataset.

## 7. Visual and interaction direction

- Use layered, readable 2.5D scenes to show place and spatial relationships. A vineyard can use an elevated landscape; a production room can use a readable interior/cutaway; a cellar can use rows or shelves. A shared selection and panel language can provide consistency even if scene composition differs.
- Scene objects are affordances and context, not the only way to reach data. Pair every key selectable object with a list or search route.
- Use scene change and selection highlight to orient the player. There are no gameplay results or event messages in this alpha.
- Keep high-density data in panels and charts. Avoid turning finance, contracts, detailed wine assessment, equipment comparison, or staff assignment into spatial minigames.
- Show company expansion as changes to owned places, facilities, capacity, and portfolio when supported. Represent distant estates as separate locations connected by a company view.
- Keep early art replaceable: stable object bounds, selection states, and layer ordering matter more than finished illustration. Do not tie domain behavior to a particular image or sprite.
- Use PixiJS for layered scenes with scene-specific fixed camera compositions; use HTML/CSS and React for accessible interface panels. Keep scene rendering and shell UI connected through one application state owner.

## 8. Delivery plan

Each slice should be reviewable before proceeding. The intended alpha stack is selected; pin package versions and verify commands during scaffolding.

1. **Create low-fidelity layouts.** Produce a shared shell and layouts for Estate, Winery, Cellar, Company, and the Management panels. Include the hideable Activity Manager, calendar and Advance Time controls, and a wine-detail modal inspired by 04. Use placeholder blocks and the local images below.
2. **Build a clickable navigation prototype.** Implement destination routing, placeholder scene selection/detail open-close behavior, the Activity Manager toggle, and default entry at Estate. Keep view preferences session-only.
3. **Validate desktop composition and accessibility.** Use a landscape 1280×720 baseline; check distinct scene camera compositions, visible navigation, panels/modal legibility, keyboard routes, and the Activity Manager sidebar/overlay.
4. **Scaffold the intended stack.** Set up TypeScript, Vite, React, and PixiJS; pin dependency versions and document verified setup/run/build commands in [PROJECT_INFO.md](../PROJECT_INFO.md).
5. **Hand off time and alerts behavior to implementation planning.** Preserve the calendar and Advance Time affordance in the shell. Their behavior and alert handling are not specified by this UI design.

### Ownership boundaries

- **Scene renderer:** draws placeholder location and selection affordances; it does not own wine facts.
- **Panels and navigation:** display placeholder layouts and route between views; they do not implement gameplay or calculate domain outcomes.
- **Future 05 simulation:** owns authoritative physical development, sensory projection, evaluation, commercial rules, and game persistence when those systems exist.

The intended alpha stack is selected, but no UI source, package manifest, installed dependencies, or application commands exist yet. Record actual files, ownership, and verified commands in [PROJECT_INFO.md](../PROJECT_INFO.md) as the application is scaffolded.

## 9. Alpha acceptance criteria

- Every destination in the approved alpha scope is reachable from persistent navigation; Management sub-panels are reachable without unique scenes.
- Estate, Winery, Cellar, and Company have distinguishable 2.5D placeholder compositions with scene-specific cameras.
- Placeholder scene/list selection opens and closes a detail panel; focused wine details can open and close in a modal inspired by 04.
- The Activity Manager can be shown and hidden from the shell as a sidebar or overlay.
- The top bar contains a calendar placeholder and an Advance Time button; no time behavior or alert design is specified by this plan.
- Company uses a dashboard-like placeholder layout with optional high-score/achievement and statue/landmark-inspired modules, without 04 values or rules.
- No game data, synthetic fixture dataset, gameplay action, alert/event UI, or player-preference persistence is required.
- The prototype opens at Estate and resets temporary view state on restart; it does not resume a saved destination or Activity Manager visibility.
- Keyboard navigation can reach scene objects through lists and can operate global navigation, detail panels, modal close behavior, and the Activity Manager toggle.
- The 1280×720 landscape baseline keeps scene, navigation, and panels legible. Mobile layout is deferred.
- No 04 formula, lifecycle state, mockup value, or unsupported game rule is presented as an implemented 05 fact.

## 10. Open decisions retained

- Exact scene art, camera framing and controls for each approved 2.5D scene.
- PixiJS version and renderer configuration, to be pinned during application scaffolding.
- Detailed panel sizing and Activity Manager placement (sidebar or overlay), plus responsive behavior beyond the 1280×720 landscape baseline.
- Which details should use panels versus focused modals once the 05 information model is available.
- Exact Management sub-navigation and the contents of its placeholder panels.

The wine/lot model, wine properties, finance, contracts, equipment, staff, research, and game actions remain in the [transition overview](../Winemaker04_to_05_Transition_Overview.md) and [system inventory](../Winemaker04_to_05_System_Inventory.md). Coding agents will handle calendar content, Advance Time behavior, and alerts. Those concerns are outside this UI design plan.

Resolve these with the corresponding simulation design and record only approved durable UI direction in [design.md](../design.md). Record implemented behavior in [application-flow.md](../application-flow.md) once there is a running application.

## 11. Visual references

The full source gallery and its discussion are in [Winemaker05 UI and Visual Concepts](../Winemaker05_UI_Visual_Concepts.md). The following local generated images are layout and mood references; all names, metrics, currencies, labels, and data inside them are illustrative.

### Scene composition

![Four overview concepts for estate, production, cellar, and company scenes](<../../image_inspiration/Winemaker_ Vingårdens fire oversigter-1.png>)

![Seasonal vineyard scene with a selected parcel and side panels](<../../image_inspiration/Efterårsro på den toscanske vingård-1.png>)

![Estate, cellar, and strategy scene studies](<../../image_inspiration/Winemaker_ Vingård, Kælder og Strategi-4.png>)

### Panel-first management

![Equipment and barrel purchasing workspace](<../../image_inspiration/ChatGPT-billede 13. nov. 2026, 12.57.17-2.png>)

![Staff, teams, tasks, and workload workspace](<../../image_inspiration/ChatGPT-billede 13. nov. 2026, 12.57.18-3.png>)
