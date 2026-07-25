import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const requireAdmin = vi.fn();
const create = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { drink: { create, findMany: vi.fn() } } }));
vi.mock('@/lib/logger');

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/drinks', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/admin/drinks', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('creates the drink and logs drink_created with the admin id and drink fields', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    create.mockResolvedValue({ id: 'drink-1', name: 'Radler', priceCents: 140, active: true });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140, active: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('drink_created', {
      userId: 'admin-1',
      meta: { drinkId: 'drink-1', name: 'Radler', price_cents: 140, active: true },
    });
  });

  it('does not create or log when requireAdmin rejects the request', async () => {
    requireAdmin.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140 }));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
