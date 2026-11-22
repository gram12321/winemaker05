# Winemaker05 architecture evaluation

- **Date:** 17 November 2026.
- **Reviewed baseline:** `63978e9` on `main`, plus the uncommitted corrections described below.
- **Purpose:** Assess the implemented architecture against the approved [design](design.md), the [technical proposal](Winemaker05_Technical_Architecture_Proposal.md), the [transition overview](Winemaker04_to_05_Transition_Overview.md), the [system migration research](Winemaker04_to_05_System_Migration_Research.md), and the [visual concepts](Winemaker05_UI_Visual_Concepts.md). This is a dated review, not an ongoing implementation-status record.

**Later decisions:** The user clarified that 05 is not live and no older saves or versions need compatibility, and subsequently selected shared name-only player profiles instead of account-backed identity. The current policy in [design.md](design.md) supersedes conflicting historical assumptions in this review. The unused JWT verifier described below was later removed; see [application flow](application-flow.md) for the current implementation.

## Assessment

The implementation is a sound **initial architecture foundation**, with particularly careful treatment of authoritative commands, immutable state, save validation, revisions and uncertain outcomes. It is not yet the full approved game architecture: the only gameplay state is the calendar and the only command advances it one week. The absence of empty weather, vineyard, work, wine, inventory, finance and market modules is appropriate at this stage; their boundaries and interactions remain to be proven when real behavior is added.

The first implementation had important recovery and renderer-lifecycle defects. They were reproduced and corrected during this evaluation. The resulting code is a stronger foundation, but it is not evidence that a complete game, a production deployment, a shared market or live account permissions have been validated.

The visual-concepts document at the supplied `61413422e8bbded99766e88f019ac96283538ef9` commit matches the document in this checkout. That commit is not an ancestor of the reviewed `main`; among the checked UI source and concept paths, the committed baseline differs only in [App.tsx](../../src/App.tsx). The established UI remains a scene-and-panel placeholder prototype rather than the detailed simulation experience illustrated by the concepts.

## Actual call chain

```text
React intent -> CompanyClient retains the command and obtains a same-origin lock
  -> authenticated HTTP authority -> owner-bound CompanySession
  -> decideCommand -> advanceTime -> calendar candidate and event
  -> PostgreSQL reservation -> atomic state + revision + receipt commit
  -> browser reloads the committed snapshot -> React calendar
```

At the time of this review, the simulation was synchronous and independent of the UI and database. [CompanySession](../../src/authority/session.ts) coordinated execution and published only a confirmed transition; [PostgresCompanySavePort](../../src/server/postgres/PostgresCompanySavePort.ts) owned storage operations and checked the owner. The then-existing JWT verifier checked bearer-token signature, issuer, audience and expiry. [SceneCanvas](../../src/scene/SceneCanvas.tsx) rendered placeholder scenes and translated selection into presentation state; it did not advance the game.

## Approved direction compared with the implementation

| Approved decisions | Assessment and evidence |
|---|---|
| 1–4: layers, company state, coordinator and explicit commands | Implemented for the calendar slice. Domain rules are under [game](../../src/game/), coordination is under [authority](../../src/authority/), and React/Pixi do not mutate game state. Multi-domain transitions and query models have not yet been exercised. |
| 5–14: trusted authority, accounts, atomic snapshots, revisions and recovery | At the time, the candidate included an HTTP authority, JWT verification, PostgreSQL adapter and browser client. Owner isolation, invalid-save preservation, revision conflicts, receipts and recovery had automated coverage. Deployment, a real signed-in browser flow, live role grants and operational hardening were unverified. |
| 15–16: one-week manual advance and calendar boundaries | Implemented and tested, including configured weeks/seasons and year boundaries. The selected startup values are defaults for new companies, not settled game balance. |
| 17–21: ordered multi-domain tick, week-end outcomes, daily wine steps and reproducible randomness | Not implemented beyond the calendar transition. There are no weather, vineyard, work or wine phases to order or validate yet; daily stepping and forecast/random behavior have not been tested. |
| 22–25: work allocation, partial harvest and obligations | Not implemented. No claims can yet be made about resource contention, applied-work XP, wages or payment order. |
| 26–31: physical lots, inventory and equipment ownership, wine development and evaluation | Not implemented. In particular, there is no lot/quantity model, bottle aging, physical solver, sensory evaluation or historical assessment. The wine dialog is a placeholder. |
| 32–37: events, durable history, notifications and shared market | A `time.advanced` fact is returned from a transition, but durable gameplay history, notification/read state, market authority, market clock and settlement are not implemented. The system is state-transition based, not event sourced. |
| 38–43: wine/product directions, finance, research and selected content | These are accepted directions for future systems, not completed features. The interface intentionally uses placeholder content and does not import 04 formulas or lifecycle states. |

The migration research and transition overview provide context and source comparisons, not proof that their 04 mechanisms work in 05. Exact wine variables, equations, commercial settlement, content and several interaction details remain open as recorded in the design.

## Defects corrected during the review

1. **Delayed duplicate after cancellation.** A two-authority test reproduced a command reported as `not-committed` that later committed through a second delayed delivery. [The storage adapter](../../src/server/postgres/PostgresCompanySavePort.ts) now records a terminal command fence under the existing company lock, fences any same-intent reservation and checks that fence before applying a delivery. A conflicting payload is not canceled. After confirmed cancellation a new decision uses a new command ID. Real PostgreSQL tests exercise both matching and competing reservations.
2. **Browser intent and switching.** Simultaneous tabs could overwrite the sole locally retained command, and the Companies control allowed leaving a known unresolved command. [CompanyClient](../../src/client/CompanyClient.ts) now coordinates command handling and switching using Web Locks; [ConnectedApp](../../src/client/ConnectedApp.tsx) observes other tabs and blocks switching while a known intent remains unresolved.
3. **Stale displayed snapshot after an action.** If a command succeeded but its follow-up reload failed, the previous UI could enable another action against the old snapshot. The connected UI now requires a successful refresh before another advance and refreshes after recovery attempts as well.
4. **Pixi shared-resource lifetime.** PixiJS 8 treats `renderer.destroy(true)` as permission to release globally registered resources. [SceneCanvas](../../src/scene/SceneCanvas.tsx) now removes its own canvas and children with an explicit option, without releasing resources shared by other renderer instances.

## Remaining risks and next work

- **Pre-reservation uncertainty:** A command lost before the server durably records it is only known to its original browser. Another device may act without knowing about that intent; revision checks prevent a stale overwrite, and the original browser must retain and recover its intent. Removing this limitation requires a broader authority/protocol design.
- **Production operations:** The candidate HTTP host keeps per-company session entries without eviction or admission limits. Receipt/fence retention is indefinite; deployment routing, abuse controls, observability, backup/restore and the real project's permissions need deliberate operational design and verification.
- **Next architecture proof:** Build a small vertical slice with real vineyard/work/inventory behavior and a partial-harvest transaction, then a physically meaningful wine process and evaluation. This is the proposal's suggested sequence, not a newly approved delivery schedule or a choice of unfinished formulas. It is the point at which cross-domain ownership, tick order, previews and atomic rollback can be tested beyond a single calendar field.
- **Visual product work:** Real scene objects and panels must eventually read the same authoritative entities and expose the wine/cellar decisions described in the design. The current placeholder navigation establishes neither those models nor the final visual design.

## Verification performed

- `npm test` with two isolated local PostgreSQL 16 test databases: **110 tests passed**, including the PostgreSQL adapter and HTTP-to-PostgreSQL suites.
- `npm run test:e2e`: **4 Chromium tests passed**, using mocked authentication and company endpoints, including cross-tab recovery and failed-refresh flows.
- `npm run build`: passed typechecking and production build; Vite reported a chunk over 500 kB.
- The multi-authority delayed-delivery regression, browser recovery cases and Pixi cleanup expectations were observed failing before their fixes and passing afterward.

These checks do not establish live Supabase login, remote database role configuration, hosting security, production load behavior or the correctness of unimplemented gameplay.
