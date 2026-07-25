/**
 * Hard safety gate for integration test setup, which TRUNCATEs every app
 * table before each test. Throws unless the connection string unambiguously
 * points at a throwaway database: a loopback host (local Postgres, CI's
 * service container), or an explicit INTEGRATION_TEST_DB_CONFIRMED=true
 * opt-in for a dedicated remote test project (e.g. a second Supabase
 * project used only for tests — its database is still named "postgres",
 * so the connection string itself carries no distinguishing marker).
 *
 * INTEGRATION_TEST_DB_CONFIRMED must only ever be set in .env.test, never
 * in .env.local, so a shared/real DATABASE_URL can't accidentally pass.
 */
export function assertDisposableDatabase(
  rawUrl: string,
  confirmed: boolean = process.env.INTEGRATION_TEST_DB_CONFIRMED === 'true'
) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`DATABASE_URL is not a valid connection string: ${rawUrl}`);
  }

  const host = parsed.hostname;
  const isLoopbackHost = ['localhost', '127.0.0.1', '::1'].includes(host);

  if (!isLoopbackHost && !confirmed) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL points at host "${host}", which isn't ` +
        'a loopback address (local Postgres / CI service container). This file TRUNCATEs every ' +
        'app table before each test. If this is genuinely a disposable database (e.g. a ' +
        'dedicated test project), set INTEGRATION_TEST_DB_CONFIRMED=true alongside it in ' +
        '.env.test — never in .env.local.'
    );
  }
}
