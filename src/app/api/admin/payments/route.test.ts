import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const upsert = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { upsert } } }));
vi.mock('@/lib/logger');

const { PATCH } = await import('./route');
const { logger } = await import('@/lib/logger');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/payments', { method: 'PATCH', body: JSON.stringify(body) });
}

describe('PATCH /api/admin/payments', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    upsert.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('logs payment_marked (by the admin, about the target player) when paid is true', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    upsert.mockResolvedValue({});

    const res = await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('payment_marked', {
      userId: 'admin-1',
      meta: { playerId: 'player-1', periodId: 'period-1' },
    });
  });

  it('logs payment_reset when paid is false', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    upsert.mockResolvedValue({});

    await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: false }));

    expect(logger.info).toHaveBeenCalledWith('payment_reset', {
      userId: 'admin-1',
      meta: { playerId: 'player-1', periodId: 'period-1' },
    });
  });

  it('does not upsert or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await PATCH(patchRequest({ playerId: 'player-1', periodId: 'period-1', paid: true }));

    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
