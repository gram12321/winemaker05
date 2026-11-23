# Supabase core-game setup

This runbook documents the current pre-release Winemaker05 PostgreSQL schema and the application performed on 22 November 2026. The configured Supabase project is initialized and verified; the guide remains the repeatable reference. A full server-authority production loop and a real-browser create/advance/plant/reload smoke passed against the project, and their exact temporary test records were deleted. The complete local and Supabase evidence is tracked in the [core-game transition plan](../../plans/2026-11-21-core-game-transition.md).

## Apply the current schema

1. In the Supabase Dashboard, select the intended pre-release project and open its SQL Editor using the project’s administrative database role.
2. Open [schema.sql](../../src/server/postgres/schema.sql), copy the whole current file into the editor, and run it as one script. Do not use an older copy or add separate game-system tables.
3. Confirm the script completes, then run [verify-setup.sql](../../src/server/postgres/verify-setup.sql) in the same project.

The canonical script wraps the reset in a transaction, drops and recreates only `winemaker05_private`, and creates the current schema. `DROP SCHEMA ... CASCADE` removes every object and development record in that private schema, plus any objects that depend on them. Apply it only to the intended pre-release project where that data may be discarded. Winemaker05 has no older-save compatibility or migration path.

The schema has five tables: `player_profiles`, `company_saves`, `command_receipts`, `pending_attempts`, and `attempt_fences`. The whole current company game state is stored in `company_saves.state` as one JSONB snapshot. Receipt, pending-attempt, and fence tables support command safety and recovery; the game’s vineyard, wine, cellar, finance, and commercial domains do not each need a separate table.

After a successful apply, the verifier should report `PASS` for the schema, five tables, nine indexes, five RLS checks, and both client-role grant checks. `ROLE_NOT_PRESENT` is expected only on stock PostgreSQL where Supabase’s `anon` and `authenticated` roles do not exist. Resolve any `MISSING`, `FAIL`, or `INVALID` result; inspect any `REVIEW` policy result. The Supabase Data API setting is not available from portable SQL. It was verified for the configured project with an anonymous read-only REST probe: HTTP 406 / PGRST106 confirms `winemaker05_private` is not exposed. For a different project, confirm this in the Dashboard.

## Keep the schema private

In the Supabase Dashboard’s Data API settings, ensure `winemaker05_private` is absent from the exposed schemas. Keep `anon` and `authenticated` without schema `USAGE` or `CREATE` and without table privileges. The canonical schema revokes those privileges when these roles exist and enables RLS on every current table; it defines no client policies. Do not grant client roles access or expose these tables through PostgREST. The verification SQL checks catalog grants and RLS but cannot read the project-level exposed-schema list. For this configured project, an anonymous REST request with `Accept-Profile: winemaker05_private` returned HTTP 406 / PGRST106, confirming the schema is not exposed; for another project, also inspect the Dashboard setting. See [Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas).

The service’s player profiles are selectable names, not authenticated accounts. Supabase Auth is not used, and profile selection does not create a private authorization boundary. Do not treat this setup as protecting a public service from users selecting another profile or shared unassigned company.

## Configure the trusted authority

The current implementation worktree has an ignored server environment prepared from the supplied local secrets file. Its pooler, CA, and strict TLS were used to apply the schema and run the verified remote smoke test; the secret values are not documented or included in browser bundles. For another checkout, set the server-only variables in its local `.env.local` using the connection details shown by the Supabase Dashboard:

```dotenv
POSTGRES_POOLER_URL=<session-pooler-connection-uri>
POSTGRES_SSL_ROOT_CERT=<path-to-trusted-supabase-root-ca-file>
```

Use the Dashboard’s session pooler URI for `POSTGRES_POOLER_URL`; the authority prefers it over `DATABASE_URL`. Keep the URI and any database password out of browser variables and source control. The root certificate variable is a filesystem path to the trusted CA PEM file. The authority verifies the server certificate (`rejectUnauthorized: true`), using that CA when supplied or the system trust store otherwise.

Do not append URL SSL options such as `ssl`, `sslmode`, `sslcert`, `sslkey`, or `sslrootcert`. The authority rejects those options so they cannot override certificate verification; configure trust with `POSTGRES_SSL_ROOT_CERT` instead. The variable names and blank examples are in [.env.example](../../.env.example), and the current connection handling is in [main.ts](../../src/server/main.ts).

## Start and smoke-check

After applying the reset to the intended pre-release project, use a disposable profile and company for this write check. It creates saved game state.

1. Start the trusted authority in one terminal:

   ```sh
   npm run authority
   ```

2. Start the UI in a second terminal:

   ```sh
   npm run dev
   ```

3. Open the local URL printed by Vite, create a disposable player profile and company, then advance one week.
4. Refresh the page and reopen that profile and company. Confirm the company and advanced calendar state load from the database.
5. Stop both local processes with Ctrl+C.

The configured Supabase project passed the schema verifier and temporary authority smoke flow. The actual application has not been deployed or hosted by this task.
