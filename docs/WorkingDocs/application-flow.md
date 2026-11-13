# Application Flow

Describe implemented 05 systems, state ownership, domain rules, and user interactions here, with links to their owning source. Distinguish implemented, partial, and deferred behavior. The [transition overview](Winemaker04_to_05_Transition_Overview.md) describes the design direction and the historical 04 reference; it does not establish 05 runtime behavior.

The current application is a navigation and presentation prototype. It uses placeholder labels and illustrations, not game data or simulation results.

## State owners and system boundaries

[App.tsx](../../src/App.tsx) owns the active destination, Management section, scene selection, Activity Manager visibility, and wine-dialog visibility in React state. These choices are not persisted and reset when the application reloads. [experience.ts](../../src/experience.ts) defines placeholder presentation content; [SceneCanvas.tsx](../../src/scene/SceneCanvas.tsx) and [drawScenes.ts](../../src/scene/drawScenes.ts) draw the current scene and pass selection intents back to the shell. No domain or persistence state exists yet.

## Actions and interactions

- The application opens at Estate. Persistent navigation switches among Estate, Winery, Cellar, Company, and Management; Management exposes Finance, Contracts / Market, Equipment, and People / Work placeholder sections.
- Each scene has selectable markers and matching accessible list buttons. Selecting either opens the same placeholder details and highlights the scene object; closing the details returns focus to its list button. Changing destinations clears the selection.
- Cellar provides a wine-detail dialog, including placeholder sections for origin, potential, development, sensory evaluation, and commercial context. Its close controls and Escape return to the underlying view.
- The Activity Manager opens as an overlay and can be closed from the shell or its close button. The close button returns focus to the shell toggle.
- The top bar shows an empty calendar and a disabled Advance Time button.

## Rules, partial systems, and deferred work

There are no implemented simulation rules, gameplay actions, time advancement, alerts, finance or market calculations, saved player preferences, or game persistence. The placeholder content does not define 05 data fields or rules. Time and alert behavior remain outside the approved UI plan.
