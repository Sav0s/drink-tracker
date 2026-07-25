import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { drink: { update } } }));
vi.mock('@/lib/logger');

const { PATCH } = await import('./route');
const { logger } = await import('@/lib/logger');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/drinks/drink-1', { method: 'PATCH', body: JSON.stringify(body) });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/drinks/[id]', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    update.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('updates the drink and logs drink_updated with only the changed fields', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    update.mockResolvedValue({});

    const res = await PATCH(patchRequest({ price_cents: 160 }), ctx('drink-1'));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('drink_updated', {
      userId: 'admin-1',
      meta: { drinkId: 'drink-1', changes: { priceCents: 160 } },
    });
  });

  it('does not update or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await PATCH(patchRequest({ price_cents: 160 }), ctx('drink-1'));

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
