-- Recreate the current Winemaker05 development schema.
-- WARNING: this deletes every table and company save in winemaker05_private.
-- Use only for pre-release development data that may be discarded. Do not run
-- against production. Winemaker05 has no older-save compatibility or upgrade
-- path; change this schema directly while the game is not live.
-- This script does not grant client access.
--
-- Only a trusted command service may hold database credentials. It binds each
-- operation to an existing selectable player profile or the shared
-- unassigned-company scope. Player profiles intentionally have
-- 04-style shared selection and are not a private authorization boundary. The
-- service runs game rules; do not expose this schema via client APIs.
-- RLS below denies roles with table access but no policy. Owners, superusers,
-- and BYPASSRLS roles can bypass RLS, so RLS is not a substitute for the
-- owner-scoped queries or for keeping a privileged connection server-only.
BEGIN;

DROP SCHEMA IF EXISTS winemaker05_private CASCADE;
CREATE SCHEMA winemaker05_private;
REVOKE ALL ON SCHEMA winemaker05_private FROM PUBLIC;

CREATE TABLE winemaker05_private.player_profiles (
  player_id uuid PRIMARY KEY,
  player_name text NOT NULL CHECK (length(btrim(player_name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_profiles_created_idx ON winemaker05_private.player_profiles (created_at, player_id);

CREATE TABLE winemaker05_private.company_saves (
  company_id text PRIMARY KEY CHECK (length(company_id) > 0),
  owner_id text NOT NULL CHECK (length(owner_id) > 0),
  company_name text NOT NULL CHECK (length(btrim(company_name)) BETWEEN 1 AND 80),
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  state jsonb NOT NULL,
  UNIQUE (company_id, owner_id)
);
CREATE INDEX company_saves_owner_name_idx ON winemaker05_private.company_saves (owner_id, company_name, company_id);

CREATE TABLE winemaker05_private.command_receipts (
  company_id text NOT NULL,
  owner_id text NOT NULL,
  command_id text NOT NULL CHECK (length(command_id) > 0),
  attempt_id text NOT NULL CHECK (length(attempt_id) > 0),
  fingerprint text NOT NULL CHECK (length(fingerprint) > 0),
  revision bigint NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
  PRIMARY KEY (company_id, command_id),
  UNIQUE (company_id, attempt_id),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES winemaker05_private.company_saves (company_id, owner_id)
    ON DELETE CASCADE
);

-- At most one in-flight write per company. This survives a lost service
-- response and is removed only by the atomic state/receipt commit or by an
-- explicitly acknowledged fence of the same command intent.
CREATE TABLE winemaker05_private.pending_attempts (
  company_id text PRIMARY KEY,
  owner_id text NOT NULL,
  attempt_id text NOT NULL CHECK (length(attempt_id) > 0),
  command_id text NOT NULL CHECK (length(command_id) > 0),
  fingerprint text NOT NULL CHECK (length(fingerprint) > 0),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES winemaker05_private.company_saves (company_id, owner_id)
    ON DELETE CASCADE
);

-- Also stores terminal command fences using the server-reserved `command:`
-- attempt-ID prefix; normal trusted attempt IDs must never use that prefix.
CREATE TABLE winemaker05_private.attempt_fences (
  company_id text NOT NULL,
  owner_id text NOT NULL,
  attempt_id text NOT NULL CHECK (length(attempt_id) > 0),
  command_id text NOT NULL CHECK (length(command_id) > 0),
  fingerprint text NOT NULL CHECK (length(fingerprint) > 0),
  PRIMARY KEY (company_id, attempt_id),
  FOREIGN KEY (company_id, owner_id)
    REFERENCES winemaker05_private.company_saves (company_id, owner_id)
    ON DELETE CASCADE
);

ALTER TABLE winemaker05_private.company_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE winemaker05_private.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE winemaker05_private.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE winemaker05_private.pending_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE winemaker05_private.attempt_fences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA winemaker05_private FROM PUBLIC;

-- Supabase may have explicit grants/default grants for these roles. Keep this
-- candidate private even when installed in a database where they already exist.
DO $security$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA winemaker05_private FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA winemaker05_private FROM %I', client_role);
    END IF;
  END LOOP;
END
$security$;

-- Retain receipts and fences for as long as any matching request can be retried
-- or arrive late. No pruning policy is assumed by this initial candidate.
COMMIT;
