import { describe, it, expect } from 'vitest';
import { assertDisposableDatabase } from './assertDisposableDatabase';

describe('assertDisposableDatabase', () => {
  it('allows a localhost connection string with no confirmation flag', () => {
    expect(() =>
      assertDisposableDatabase(
        'postgresql://postgres:postgres@localhost:5432/drink_tracker_test',
        false
      )
    ).not.toThrow();
  });

  it('allows a 127.0.0.1 connection string with no confirmation flag', () => {
    expect(() =>
      assertDisposableDatabase('postgresql://postgres:postgres@127.0.0.1:5432/postgres', false)
    ).not.toThrow();
  });

  it('allows a remote host when explicitly confirmed', () => {
    expect(() =>
      assertDisposableDatabase(
        'postgresql://postgres.subpgjasqrzfidnnwtzh:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
        true
      )
    ).not.toThrow();
  });

  it('rejects a remote host without confirmation (e.g. the real Supabase pooler in .env.local)', () => {
    expect(() =>
      assertDisposableDatabase(
        'postgresql://postgres.abc123:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
        false
      )
    ).toThrow(/Refusing to run integration tests/);
  });

  it('rejects an invalid connection string', () => {
    expect(() => assertDisposableDatabase('not-a-url', false)).toThrow(
      /not a valid connection string/
    );
  });

  it('defaults the confirmation flag from INTEGRATION_TEST_DB_CONFIRMED when not passed explicitly', () => {
    const original = process.env.INTEGRATION_TEST_DB_CONFIRMED;
    process.env.INTEGRATION_TEST_DB_CONFIRMED = 'true';
    try {
      expect(() =>
        assertDisposableDatabase('postgresql://user:pw@remote-host.example.com:5432/postgres')
      ).not.toThrow();
    } finally {
      if (original === undefined) delete process.env.INTEGRATION_TEST_DB_CONFIRMED;
      else process.env.INTEGRATION_TEST_DB_CONFIRMED = original;
    }
  });
});
