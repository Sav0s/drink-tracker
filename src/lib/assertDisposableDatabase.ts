/**
 * Hard safety gate for integration test setup, which TRUNCATEs every app
 * table before each test. Throws unless the connection string unambiguously
 * points at a throwaway database — a loopback host (local Postgres, CI's
 * service container) or a database name that marks itself as a test DB.
 * Everything else (Supabase poolers, any remote host) is rejected, no matter
 * what's sitting in .env.local.
 */
export function assertDisposableDatabase(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`DATABASE_URL is not a valid connection string: ${rawUrl}`);
  }

  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '');
  const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(host);
  const isMarkedTestDb = /test/i.test(dbName);

  if (!isLoopbackHost && !isMarkedTestDb) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL points at host "${host}" / ` +
        `database "${dbName}", which doesn't look disposable (not localhost, and the ` +
        'database name has no "test" marker). This file TRUNCATEs every app table ' +
        'before each test. Point DATABASE_URL at a local or CI-only Postgres instance.'
    );
  }
}
