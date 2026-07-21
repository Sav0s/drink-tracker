import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { GET, POST } = await import('./route');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/drinks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Reference test for the requireAdmin() gating pattern shared by every
// /api/admin/* route — exercised here against a real DB-backed player row,
// with only the Supabase auth provider stubbed.
describe('/api/admin/drinks auth gating', () => {
  it('GET returns 401 when not authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('GET returns 403 for a logged-in non-admin', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it('GET returns 200 with the drink list for an admin', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await prisma.drink.create({ data: { name: 'Bier', priceCents: 150, active: true } });

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drinks).toMatchObject([{ name: 'Bier', price_cents: 150, active: true }]);
  });

  it('POST creates a drink as an admin', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140, active: true }));

    expect(res.status).toBe(200);
    const { id } = await res.json();
    const drink = await prisma.drink.findUnique({ where: { id } });
    expect(drink).toMatchObject({ name: 'Radler', priceCents: 140, active: true });
  });

  it('POST rejects a non-admin with 403 and does not create anything', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await POST(postRequest({ name: 'Radler', price_cents: 140, active: true }));

    expect(res.status).toBe(403);
    expect(await prisma.drink.count()).toBe(0);
  });
});
