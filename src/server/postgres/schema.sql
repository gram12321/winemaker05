-- Initial Winemaker05 candidate schema, not a Winemaker04 migration.
-- Run once by the deployment owner; this script does not grant client access.
--
-- Only a trusted command service may hold the database credentials. The host
-- authenticates each request and binds its verified principal to a port
-- instance; never take the principal, a candidate state, or these credentials
-- from an untrusted client. Do not expose this schema via PostgREST/client APIs.
-- RLS below denies roles with table access but no policy. Owners, superusers,
-- and BYPASSRLS roles can bypass RLS, so RLS is not a substitute for the
-- owner-scoped queries or for keeping a privileged connection server-only.
CREATE SCHEMA winemaker05_private;
REVOKE ALL ON SCHEMA winemaker05_private FROM PUBLIC;

CREATE TABLE winemaker05_private.company_saves (
  company_id text PRIMARY KEY CHECK (length(company_id) > 0),
  owner_id text NOT NULL CHECK (length(owner_id) > 0),
  schema_version integer NOT NULL,
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  state jsonb NOT NULL,
  UNIQUE (company_id, owner_id)
);

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
-- explicitly acknowledged fence of the same attempt.
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
