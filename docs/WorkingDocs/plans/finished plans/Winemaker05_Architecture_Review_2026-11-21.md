# Winemaker05 foundation review — 21 November 2026

This review assesses the implemented player, company, authority and calendar foundation against the approved [design](design.md), [technical proposal](Winemaker05_Technical_Architecture_Proposal.md), [transition overview](Winemaker04_to_05_Transition_Overview.md) and [system migration research](Winemaker04_to_05_System_Migration_Research.md). Later decisions in the design record supersede older proposals, especially the decision to use shared, name-only player profiles. The earlier [architecture evaluation](Winemaker05_Architecture_Evaluation.md) is a dated record of a different baseline.

## Assessment

The existing core was worth retaining: the game transition is synchronous and independent of the browser and database; the trusted company session evaluates commands; the PostgreSQL adapter uses revisions, receipts, durable reservations and fences to commit once and handle uncertainty. Those mechanisms address real multi-writer and lost-response cases, and reducing them to a simple save call would weaken the approved behavior.

The integration around that core contained avoidable inconsistencies. The work in this review removed the unused account/JWT path, gave player and unassigned company selection one explicit scope contract, moved storage contracts out of HTTP, separated the server session registry from request routing, and separated the welcome, player-selection and company-workspace views from connection orchestration. An unassigned company no longer needs a fabricated player record. It consolidated company creation recovery and made player creation retryable by a stable ID. Completed idle sessions are released while recovery-bearing sessions remain available.

```text
Player selection / company intent
  -> browser clients and retained request IDs
  -> HTTP authority validates the selected scope
  -> company-session registry -> CompanySession -> domain command / calendar transition
  -> owner-scoped PostgreSQL transaction, revision and receipt
  -> reload committed snapshot -> React / Pixi presentation
```

The selection headers identify a shared profile or the unassigned scope; they are not authentication credentials. Anyone with access to the service can select the profiles and unassigned companies, as agreed in [design.md](design.md). The server remains authoritative for game rules and database writes. Private accounts and a secure shared-market identity model are future work, not behavior supplied by the deleted JWT code.

## Corrected findings

1. **Conflicting identity mechanisms.** The browser passed a token-shaped value and a separate owner key, and the HTTP host retained an unused optional bearer path alongside selectable profiles. [Company scope](../../src/shared/companyScope.ts) now supplies one typed selection to the browser client; the authority validates it against the profile store and derives the corresponding owner key. Ambiguous scope headers are rejected. The unused verifier and dependency were removed.
2. **Storage contracts depended on HTTP.** The PostgreSQL profile adapter imported its contract from the HTTP server and company selection/creation types were declared there. The [profile contract](../../src/server/playerProfiles.ts) and [company contracts](../../src/authority/contracts.ts) now belong to the trusted application boundary.
3. **Creation could be duplicated or become stuck.** Company recovery was implemented separately in two React flows, could overwrite an in-flight intent across tabs, and did not show a usable recovery path for malformed records. Profile creation had no repeat-safe ID. [CompanyClient](../../src/client/CompanyClient.ts) and [playerProfiles](../../src/client/playerProfiles.ts) now retain a stable ID and name under a cross-tab lock, retry the same request, and distinguish confirmed conflicts from unknown outcomes. The PostgreSQL profile store returns the existing matching record without replacing another profile.
4. **Session lifetime was unbounded for ordinary traffic.** [CompanySessions](../../src/server/companySessions.ts) serializes work per scope/company and releases a settled idle session. It retains unresolved and refresh-required sessions so their in-memory recovery information is not silently lost.
5. **Verification did not cross the new profile boundary.** The HTTP/PostgreSQL test had used a synthetic bearer identity and a fake profile store. The integration test now uses the real profile adapter; an opt-in [browser test](../../tests/e2e/local-postgres.pw.ts) exercises player creation, company creation, advancement, reload and reopening against isolated PostgreSQL.

## Remaining boundaries

- Only calendar advancement is implemented. Vineyard, work, inventory, wine, finance, market and progression interactions have not tested the proposed multi-domain ownership and tick order; their real implementations must supply that evidence rather than speculative empty modules.
- A command lost before durable reservation is known only to its original browser. The browser must retain and retry it; another device cannot discover it automatically. Receipt/fence retention, unresolved-session admission limits and production operations remain to be designed.
- The shared profile model is intentionally not private authentication. Production access control, deployment, complete database role grants, backups and the future shared-market authority are not established by this foundation.
- The configured Supabase connection was checked read-only with certificate verification. Expected tables and columns were readable, RLS was enabled on those tables, and `anon`/`authenticated` lacked schema usage and direct SELECT on profiles and saves. No remote data or schema was changed; this is not a complete permission audit or a live remote write/browser test.

## Verification

- `npm test`: 122 tests passed, including the adapter and HTTP integration suites against separate disposable local PostgreSQL databases. An earlier run alongside other checks timed out in a prototype UI test; that test passed alone and the full suite passed on subsequent runs.
- `npm run test:e2e`: ten browser tests passed, including the full local PostgreSQL flow; the remaining browser tests use mocked endpoints.
- `npm run build`: type-check and production build passed. Vite reported a chunk larger than 500 kB.
- The remote Supabase observations above came from read-only queries. They do not establish successful remote writes or deployment behavior.

Current implementation details and development commands are maintained in [application flow](application-flow.md) and [project information](PROJECT_INFO.md).
