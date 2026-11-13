---
name: supabase-best-practices
description: Apply Supabase and PostgreSQL query, schema, security, and performance guidance when working with those technologies.
metadata:
  author: supabase
  version: "1.1.0"
  organization: Supabase
---

# Supabase and PostgreSQL Practices

Use only when the task actually involves Supabase or PostgreSQL. Winemaker04 used these technologies; that does not establish a 05 backend or schema.

- Identify the owner of the data access, the source of each filter, and the intended transaction boundary. Keep business rules out of presentation code.
- Check authorization, row-level security, and tenant or player scoping when the chosen data model requires them. Use isolated data for live checks.
- Diagnose query plans, indexes, connection limits, and lock behavior before optimizing. Preserve actual existing data according to the user's requirements.
- Keep schema changes and migrations consistent with the chosen project workflow. Do not create live resources or apply remote migrations without task authorization.

The 04-sourced [reference library](references/) has on-demand guidance for [query indexes](references/query-missing-indexes.md), [row-level security](references/security-rls-basics.md), [N+1 queries](references/data-n-plus-one.md), [locking](references/lock-short-transactions.md), and [query plans](references/monitor-explain-analyze.md). Confirm applicability and versions before following examples.
