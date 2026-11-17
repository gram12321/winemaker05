import { Pool } from 'pg';
import { readFileSync } from 'node:fs';

import { createSupabaseAuthenticator } from './api/auth';
import { readCompanyConfigFromEnvironment } from './api/config';
import { createApiServer } from './api/server';
import { PostgresCompanySavePort } from './postgres';

/**
 * Local startup entry only. Deployment, account provisioning, TLS/reverse
 * proxy, resource limits and production operations must be configured
 * separately. This does not install a schema.
 */
function start(): void {
  const databaseUrl = process.env.POSTGRES_POOLER_URL?.trim() || process.env.DATABASE_URL?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (!databaseUrl || !supabaseUrl) throw new Error('DATABASE_URL and SUPABASE_URL are required.');
  // pg connection-string SSL parameters override the ssl object. Do not let
  // them silently disable certificate verification or replace the trusted CA.
  const databaseParams = new URL(databaseUrl).searchParams;
  if (['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) => databaseParams.has(key))) {
    throw new Error('Configure database TLS with POSTGRES_SSL_ROOT_CERT, not URL SSL parameters.');
  }

  const portText = process.env.WINEMAKER_PORT ?? '3002';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('WINEMAKER_PORT must be a valid TCP port.');
  }
  const host = process.env.WINEMAKER_HOST ?? '127.0.0.1';
  const newCompany = readCompanyConfigFromEnvironment(process.env);
  const authenticate = createSupabaseAuthenticator(supabaseUrl);
  const caPath = process.env.POSTGRES_SSL_ROOT_CERT?.trim();
  const pool = new Pool({
    connectionString: databaseUrl,
    // Always verify the database server, using a configured root CA when needed.
    ssl: caPath ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true } : { rejectUnauthorized: true },
  });
  pool.on('error', () => { console.error('An idle database connection failed.'); });
  const server = createApiServer({
    authenticate,
    storeForOwner: (ownerId) => new PostgresCompanySavePort(pool, ownerId),
    newCompany,
  });

  server.on('error', () => {
    console.error('The company authority could not start or encountered a server error.');
    void pool.end();
    process.exitCode = 1;
  });
  server.listen(Number(portText), host, () => {
    console.log(`Company authority listening on ${host}:${portText}.`);
  });
  const shutdown = () => {
    server.close(() => { void pool.end(); });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  start();
} catch {
  console.error('The company authority configuration is invalid.');
  process.exitCode = 1;
}
