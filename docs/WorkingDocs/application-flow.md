# Application Flow

Describe implemented 05 systems, state ownership, domain rules, and user interactions here, with links to their owning source. Distinguish implemented, partial, and deferred behavior. The [transition overview](Winemaker04_to_05_Transition_Overview.md) describes the design direction and the historical 04 reference; it does not establish 05 runtime behavior.

The browser connects the navigation prototype to the company authority. The available gameplay is creating or loading a company and advancing its calendar; wine production and the other game systems remain unimplemented.

## State owners and system boundaries

- [Game state and commands](../../src/game/core/) contain the company calendar and the `time.advance` command. [Calendar rules](../../src/game/calendar/Calendar.ts) validate explicitly supplied calendar lengths and dates; new companies use the trusted server configuration and its current defaults. [AdvanceTime](../../src/game/simulation/AdvanceTime.ts) calculates a new calendar state and a boundary event synchronously without modifying its input.
- [CompanySession](../../src/authority/session.ts) coordinates commands and committed snapshots using the [save-port contract](../../src/authority/contracts.ts). The [PostgreSQL candidate](../../src/server/postgres/PostgresCompanySavePort.ts) owns versioned company snapshots, revisions, receipts and attempt recovery through transactions. Its connection and verified owner identity belong to trusted server code.
- The [HTTP authority](../../src/server/api/server.ts) authenticates requests and supplies the trusted company session; [Supabase JWT verification](../../src/server/api/auth.ts) checks signing keys and claims. The server is a candidate implementation, not a deployed account service.
- [Browser client](../../src/client/) signs in through Supabase Auth, lists owner-scoped companies, sends commands to the authority and retains uncertain command intents in browser storage. The Vite development proxy forwards `/api` to the local authority.
- [React presentation](../../src/App.tsx) owns temporary navigation, selection, panel, and dialog state. [Pixi scenes](../../src/scene/SceneCanvas.tsx) draw placeholders and translate pointer input into presentation intents. They do not run simulation or write saves.

## Actions and interactions

- The prototype opens at Estate. The user can navigate Estate, Winery, Cellar, Company and the Management panels, select placeholder scene features through the scene or its list, open and close details and the wine dialog, and toggle the Activity Manager. Once a company is loaded, its committed calendar appears in the top bar and Advance Time submits a command. Navigation and panel state are not saved.
- The server supports company creation, loading, command dispatch and uncertain-command resolution for an authenticated owner. Creation uses server-owned calendar configuration, not values supplied by the client. A successful `time.advance` command advances one configured week, reports season/year boundaries, and is published only after the candidate commit. The [relationship map](VariableRelationshipMap.md) describes the currently implemented calendar dependency.

## Rules, partial systems, and deferred work

- The implemented tick only advances the calendar. Weather, vineyard growth, staff work, wine development and evaluation, finance, progression, the shared market and other gameplay are not implemented. No daily wine substeps or wine formulas are implied.
- The database records pending attempts once reserved and can resolve or fence them from another process. A request lost before any reservation is durable cannot be discovered from storage alone: the client must retain its original command ID and payload, block conflicting choices and retry that same intent until the outcome is known. Revision checks and receipts prevent stale overwrites and duplicate commits; they do not replace that client-side recovery.
- The browser retains each command ID and payload before sending, blocks another command while the result is uncertain, and provides recovery. A different device can resolve a server-known reservation; if the server has no record, only the original browser can retry its retained intent. Local storage must remain available. Production hosting must provide its own same-origin `/api` routing, TLS and operations. The configured Supabase pooler was tested with certificate verification using the supplied root CA. An isolated live database test used a synthetic identity to create, load, advance, retry and reload a company, then removed that test company. Real Supabase sign-in and a signed-in browser session against the remote project remain unverified.
