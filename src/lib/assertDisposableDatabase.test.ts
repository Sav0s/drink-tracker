import { describe, it, expect } from 'vitest';
import { assertDisposableDatabase } from './assertDisposableDatabase';

describe('assertDisposableDatabase', () => {
  it('allows a localhost connection string', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://postgres:postgres@localhost:5432/drink_tracker_test')
    ).not.toThrow();
  });

  it('allows a 127.0.0.1 connection string', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://postgres:postgres@127.0.0.1:5432/postgres')
    ).not.toThrow();
  });

  it('allows a remote host whose database name is marked as a test DB', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://user:pass@db.example.com:5432/app_test')
    ).not.toThrow();
  });

  it('rejects a remote host with a non-test database name (e.g. the real Supabase pooler)', () => {
    expect(() =>
      assertDisposableDatabase(
        'postgresql://postgres.abc123:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
      )
    ).toThrow(/Refusing to run integration tests/);
  });

  it('rejects an invalid connection string', () => {
    expect(() => assertDisposableDatabase('not-a-url')).toThrow(
      /not a valid connection string/
    );
  });
});
