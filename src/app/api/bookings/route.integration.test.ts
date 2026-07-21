import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedDrink, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { GET, POST } = await import('./route');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('/api/bookings', () => {
  it('POST returns 401 when not authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postRequest({ drinkId: 'does-not-matter' }));

    expect(res.status).toBe(401);
  });

  it('POST returns 409 when there is no active billing period', async () => {
    const player = await seedPlayer();
    const drink = await seedDrink();
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await POST(postRequest({ drinkId: drink.id }));

    expect(res.status).toBe(409);
  });

  it('POST creates a booking tied to the active period', async () => {
    const player = await seedPlayer();
    const drink = await seedDrink();
    const period = await seedActivePeriod();
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await POST(postRequest({ drinkId: drink.id }));
    expect(res.status).toBe(200);
    const { id } = await res.json();

    const booking = await prisma.booking.findUnique({ where: { id } });
    expect(booking).toMatchObject({ playerId: player.id, drinkId: drink.id, periodId: period.id });
  });

  it('GET aggregates a player\'s bookings per period with the correct total', async () => {
    const player = await seedPlayer();
    const drink = await seedDrink({ priceCents: 150 });
    const period = await seedActivePeriod();
    await prisma.booking.createMany({
      data: [
        { playerId: player.id, drinkId: drink.id, periodId: period.id },
        { playerId: player.id, drinkId: drink.id, periodId: period.id },
      ],
    });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await GET();
    const body = await res.json();

    expect(body.periods).toHaveLength(1);
    expect(body.periods[0]).toMatchObject({ count: 2, total_cents: 300 });
  });

  it('GET only returns the requesting player\'s own bookings', async () => {
    const player = await seedPlayer();
    const otherPlayer = await seedPlayer();
    const drink = await seedDrink();
    const period = await seedActivePeriod();
    await prisma.booking.create({ data: { playerId: otherPlayer.id, drinkId: drink.id, periodId: period.id } });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await GET();
    const body = await res.json();

    expect(body.periods).toHaveLength(0);
  });
});
