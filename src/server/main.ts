import { Pool } from 'pg';

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
  const databaseUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!databaseUrl || !supabaseUrl) throw new Error('DATABASE_URL and SUPABASE_URL are required.');

  const portText = process.env.WINEMAKER_PORT ?? '3002';
  if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('WINEMAKER_PORT must be a valid TCP port.');
  }
  const host = process.env.WINEMAKER_HOST ?? '127.0.0.1';
  const newCompany = readCompanyConfigFromEnvironment(process.env);
  const authenticate = createSupabaseAuthenticator(supabaseUrl);
  const pool = new Pool({ connectionString: databaseUrl });
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
