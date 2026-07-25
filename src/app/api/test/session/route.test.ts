import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { player: { upsert: vi.fn() }, $executeRaw: vi.fn() },
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

const { POST } = await import('./route');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/test/session', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/test/session', () => {
  const originalPlaywrightTest = process.env.PLAYWRIGHT_TEST;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.PLAYWRIGHT_TEST = 'true';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/drink_tracker_test';
  });

  afterEach(() => {
    if (originalPlaywrightTest === undefined) delete process.env.PLAYWRIGHT_TEST;
    else process.env.PLAYWRIGHT_TEST = originalPlaywrightTest;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('returns 404 when PLAYWRIGHT_TEST is not "true"', async () => {
    delete process.env.PLAYWRIGHT_TEST;

    const res = await POST(postRequest({ userId: 'e2e-player-001', isAdmin: false }));

    expect(res.status).toBe(404);
  });

  it('refuses to run against a non-disposable DATABASE_URL even when PLAYWRIGHT_TEST is true', async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres.realproject:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

    await expect(POST(postRequest({ userId: 'e2e-player-001', isAdmin: false }))).rejects.toThrow(
      /Refusing to run integration tests/
    );
  });
});
