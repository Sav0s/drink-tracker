import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findMany = vi.fn();
const paymentDeleteMany = vi.fn();
const bookingDeleteMany = vi.fn();
const billingPeriodDeleteMany = vi.fn();
const playerDeleteMany = vi.fn();
const drinkDeleteMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    player: { findMany, deleteMany: playerDeleteMany },
    payment: { deleteMany: paymentDeleteMany },
    booking: { deleteMany: bookingDeleteMany },
    billingPeriod: { deleteMany: billingPeriodDeleteMany },
    drink: { deleteMany: drinkDeleteMany },
  },
}));

const { POST } = await import('./route');

describe('POST /api/test/cleanup', () => {
  const originalPlaywrightTest = process.env.PLAYWRIGHT_TEST;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    paymentDeleteMany.mockReset();
    bookingDeleteMany.mockReset();
    billingPeriodDeleteMany.mockReset();
    playerDeleteMany.mockReset();
    drinkDeleteMany.mockReset();
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

    const res = await POST();

    expect(res.status).toBe(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('refuses to run against a non-disposable DATABASE_URL even when PLAYWRIGHT_TEST is true', async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres.realproject:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

    await expect(POST()).rejects.toThrow(/Refusing to run integration tests/);
    expect(findMany).not.toHaveBeenCalled();
    expect(billingPeriodDeleteMany).not.toHaveBeenCalled();
  });

  it('scopes payment/booking deletes to E2E test players and returns ok', async () => {
    findMany.mockResolvedValue([{ id: 'e2e-player-1' }, { id: 'e2e-admin-1' }]);

    const res = await POST();

    expect(paymentDeleteMany).toHaveBeenCalledWith({
      where: { playerId: { in: ['e2e-player-1', 'e2e-admin-1'] } },
    });
    expect(bookingDeleteMany).toHaveBeenCalledWith({
      where: { playerId: { in: ['e2e-player-1', 'e2e-admin-1'] } },
    });
    expect(billingPeriodDeleteMany).toHaveBeenCalledWith({});
    expect(playerDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['e2e-player-1', 'e2e-admin-1'] } },
    });
    expect(drinkDeleteMany).toHaveBeenCalledWith({ where: { name: { startsWith: 'E2E' } } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('skips payment/booking/player deletes entirely when there are no E2E test players', async () => {
    findMany.mockResolvedValue([]);

    await POST();

    expect(paymentDeleteMany).not.toHaveBeenCalled();
    expect(bookingDeleteMany).not.toHaveBeenCalled();
    expect(playerDeleteMany).not.toHaveBeenCalled();
    expect(billingPeriodDeleteMany).toHaveBeenCalledWith({});
  });
});
