-- Read-only catalog checks for the current Winemaker05 schema.
-- Safe on stock PostgreSQL 16 and Supabase. No application rows are read.
-- If the schema is absent, each query reports it instead of raising an error.

-- 1. Current private schema.
SELECT
  'schema'::text AS check_group,
  'winemaker05_private'::text AS object_name,
  CASE WHEN n.oid IS NULL THEN 'MISSING' ELSE 'PASS' END::text AS status,
  CASE
    WHEN n.oid IS NULL THEN 'Apply the current src/server/postgres/schema.sql in this database.'
    ELSE 'Private Winemaker05 schema exists.'
  END::text AS details
FROM (VALUES (1)) AS seed(dummy)
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private';

-- 2. Expected current tables.
WITH expected(table_name) AS (
  VALUES
    ('player_profiles'),
    ('company_saves'),
    ('command_receipts'),
    ('pending_attempts'),
    ('attempt_fences')
)
SELECT
  'table'::text AS check_group,
  e.table_name::text AS object_name,
  CASE
    WHEN n.oid IS NULL THEN 'MISSING_SCHEMA'
    WHEN c.oid IS NULL THEN 'MISSING'
    ELSE 'PASS'
  END::text AS status,
  CASE
    WHEN n.oid IS NULL THEN 'Schema winemaker05_private is absent; apply the current schema.sql.'
    WHEN c.oid IS NULL THEN format('Expected table winemaker05_private.%I is absent; apply the current schema.sql.', e.table_name)
    ELSE 'Expected table exists.'
  END::text AS details
FROM expected e
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = e.table_name
 AND c.relkind IN ('r', 'p')
ORDER BY e.table_name;

-- 3. Expected primary-key, unique-constraint, and named lookup indexes.
WITH expected(table_name, index_name) AS (
  VALUES
    ('player_profiles', 'player_profiles_pkey'),
    ('player_profiles', 'player_profiles_created_idx'),
    ('company_saves', 'company_saves_pkey'),
    ('company_saves', 'company_saves_company_id_owner_id_key'),
    ('company_saves', 'company_saves_owner_name_idx'),
    ('command_receipts', 'command_receipts_pkey'),
    ('command_receipts', 'command_receipts_company_id_attempt_id_key'),
    ('pending_attempts', 'pending_attempts_pkey'),
    ('attempt_fences', 'attempt_fences_pkey')
)
SELECT
  'index'::text AS check_group,
  e.index_name::text AS object_name,
  CASE
    WHEN n.oid IS NULL THEN 'MISSING_SCHEMA'
    WHEN t.oid IS NULL THEN 'MISSING_TABLE'
    WHEN i.oid IS NULL OR ix.indexrelid IS NULL THEN 'MISSING'
    WHEN NOT ix.indisvalid OR NOT ix.indisready THEN 'INVALID'
    ELSE 'PASS'
  END::text AS status,
  CASE
    WHEN n.oid IS NULL THEN 'Schema winemaker05_private is absent; apply the current schema.sql.'
    WHEN t.oid IS NULL THEN format('Expected table winemaker05_private.%I is absent; apply the current schema.sql.', e.table_name)
    WHEN i.oid IS NULL OR ix.indexrelid IS NULL THEN format('Expected index %I on winemaker05_private.%I is absent; apply the current schema.sql.', e.index_name, e.table_name)
    WHEN NOT ix.indisvalid OR NOT ix.indisready THEN format('Index %I exists but is not valid and ready.', e.index_name)
    ELSE format('Valid index exists on winemaker05_private.%I.', e.table_name)
  END::text AS details
FROM expected e
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private'
LEFT JOIN pg_class t
  ON t.relnamespace = n.oid
 AND t.relname = e.table_name
 AND t.relkind IN ('r', 'p')
LEFT JOIN pg_class i
  ON i.relnamespace = n.oid
 AND i.relname = e.index_name
 AND i.relkind IN ('i', 'I')
LEFT JOIN pg_index ix
  ON ix.indexrelid = i.oid
 AND ix.indrelid = t.oid
ORDER BY e.index_name;

-- 4. RLS is enabled on every expected table; this reset schema defines no policies.
WITH expected(table_name) AS (
  VALUES
    ('player_profiles'),
    ('company_saves'),
    ('command_receipts'),
    ('pending_attempts'),
    ('attempt_fences')
)
SELECT
  'RLS'::text AS check_group,
  e.table_name::text AS object_name,
  CASE
    WHEN n.oid IS NULL THEN 'MISSING_SCHEMA'
    WHEN c.oid IS NULL THEN 'MISSING_TABLE'
    WHEN NOT c.relrowsecurity THEN 'FAIL'
    WHEN count(p.oid) > 0 THEN 'REVIEW'
    ELSE 'PASS'
  END::text AS status,
  CASE
    WHEN n.oid IS NULL THEN 'Schema winemaker05_private is absent; apply the current schema.sql.'
    WHEN c.oid IS NULL THEN format('Expected table winemaker05_private.%I is absent; apply the current schema.sql.', e.table_name)
    WHEN NOT c.relrowsecurity THEN 'RLS is disabled; the current schema enables it on every table.'
    WHEN count(p.oid) > 0 THEN format('RLS is enabled with %s policy/policies; the current reset schema defines none. Review before accepting.', count(p.oid))
    ELSE 'RLS is enabled and no policies are defined, matching the current private schema.'
  END::text AS details
FROM expected e
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = e.table_name
 AND c.relkind IN ('r', 'p')
LEFT JOIN pg_policy p ON p.polrelid = c.oid
GROUP BY e.table_name, n.oid, c.oid, c.relrowsecurity
ORDER BY e.table_name;

-- 5. Effective schema access for Supabase client roles, when those roles exist.
WITH expected(role_name) AS (VALUES ('anon'), ('authenticated'))
SELECT
  'client schema grants'::text AS check_group,
  e.role_name::text AS object_name,
  CASE
    WHEN r.oid IS NULL THEN 'ROLE_NOT_PRESENT'
    WHEN n.oid IS NULL THEN 'NOT_CHECKED_SCHEMA_MISSING'
    WHEN has_schema_privilege(r.oid, n.oid, 'USAGE')
      OR has_schema_privilege(r.oid, n.oid, 'CREATE') THEN 'FAIL'
    ELSE 'PASS'
  END::text AS status,
  CASE
    WHEN r.oid IS NULL THEN format('Role %I is absent; this check is skipped on stock PostgreSQL and expected to exist in Supabase.', e.role_name)
    WHEN n.oid IS NULL THEN 'Schema is absent; apply schema.sql before reviewing client-role grants.'
    WHEN has_schema_privilege(r.oid, n.oid, 'USAGE')
      OR has_schema_privilege(r.oid, n.oid, 'CREATE') THEN 'Unexpected effective schema USAGE or CREATE privilege is present.'
    ELSE 'No effective schema USAGE or CREATE privilege.'
  END::text AS details
FROM expected e
LEFT JOIN pg_roles r ON r.rolname = e.role_name
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private'
ORDER BY e.role_name;

-- 6. Effective table privileges for client roles on tables in this private schema.
WITH expected(role_name) AS (VALUES ('anon'), ('authenticated')),
privileges(privilege_name) AS (
  VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
)
SELECT
  'client table grants'::text AS check_group,
  e.role_name::text AS object_name,
  CASE
    WHEN r.oid IS NULL THEN 'ROLE_NOT_PRESENT'
    WHEN n.oid IS NULL THEN 'NOT_CHECKED_SCHEMA_MISSING'
    WHEN EXISTS (
      SELECT 1
      FROM pg_class c
      CROSS JOIN privileges p
      WHERE c.relnamespace = n.oid
        AND c.relkind IN ('r', 'p')
        AND has_table_privilege(r.oid, c.oid, p.privilege_name)
    ) THEN 'FAIL'
    ELSE 'PASS'
  END::text AS status,
  CASE
    WHEN r.oid IS NULL THEN format('Role %I is absent; this check is skipped on stock PostgreSQL and expected to exist in Supabase.', e.role_name)
    WHEN n.oid IS NULL THEN 'Schema is absent; apply schema.sql before reviewing client-role grants.'
    ELSE format(
      'Effective table privileges: %s.',
      COALESCE((
        SELECT string_agg(
          format('%I %s', c.relname, p.privilege_name),
          '; ' ORDER BY c.relname, p.privilege_name
        )
        FROM pg_class c
        CROSS JOIN privileges p
        WHERE c.relnamespace = n.oid
          AND c.relkind IN ('r', 'p')
          AND has_table_privilege(r.oid, c.oid, p.privilege_name)
      ), 'none')
    )
  END::text AS details
FROM expected e
LEFT JOIN pg_roles r ON r.rolname = e.role_name
LEFT JOIN pg_namespace n ON n.nspname = 'winemaker05_private'
ORDER BY e.role_name;

-- 7. This setting lives in Supabase project configuration, not PostgreSQL catalogs.
SELECT
  'manual project setting'::text AS check_group,
  'PostgREST exposed schemas'::text AS object_name,
  'MANUAL'::text AS status,
  'In Supabase Data API settings, confirm winemaker05_private is absent from exposed schemas.'::text AS details;
