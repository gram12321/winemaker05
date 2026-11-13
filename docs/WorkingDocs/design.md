# Design

Record approved product direction and user-facing decisions here; identify proposals and open questions separately. The detailed source for the initial 05 direction is the [transition overview](Winemaker04_to_05_Transition_Overview.md), which is a working design document rather than an implementation specification.

## Established direction

Winemaker05 aims to connect vineyard and harvest, inherited potential, evolving wine, cellar decisions, and commercial management. The redesign separates agricultural potential from commercial origin prestige and inherited potential from mutable development. Structure and taste are intended to use a shared moving-target evaluation framework.

The authoritative wine/lot model and the central cellar workflow should inform each other. Exact variables, lifecycle representation, equations, and many interactions remain open; the 04 implementation is a reference rather than the 05 schema.

## Agreed presentation direction

The alpha uses a 2.5D world organized into scenes, supported by accessible management panels. Its application shell uses TypeScript, Vite, and React; PixiJS renders layered scenes with fixed, scene-specific compositions. HTML/CSS and React handle navigation and panels. The prototype uses placeholders without game data or persistence. PixiJS is pinned in the project manifest; renderer details and scene composition remain open.

## Open decisions and proposals

See the transition overview for the current questions. Add new proposals with an explicit status; do not describe them as implemented.
