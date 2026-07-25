import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { GET, POST } = await import('./route');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('/api/admin/billing-periods', () => {
  it('POST rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });

    const res = await POST(postRequest({ startDate: '2026-07-01' }));

    expect(res.status).toBe(403);
  });

  it('POST requires a startDate', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });

    const res = await POST(postRequest({}));

    expect(res.status).toBe(400);
  });

  it('POST rejects with 409 when a period is already active', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await seedActivePeriod({ startDate: new Date('2026-06-01') });

    const res = await POST(postRequest({ startDate: '2026-07-01' }));

    expect(res.status).toBe(409);
    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(1);
  });

  it('POST opens a new active period once none is active', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01'), status: 'closed' },
    });

    const res = await POST(
      postRequest({ startDate: '2026-07-01', endDate: null, paymentInstructions: 'IBAN X' })
    );
    expect(res.status).toBe(200);

    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(1);
    expect(activePeriods[0]).toMatchObject({ paymentInstructions: 'IBAN X' });
  });

  it('GET returns 401 when not authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('GET lists periods newest first with raw startDate/endDate', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    await prisma.billingPeriod.createMany({
      data: [
        { startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'), status: 'closed' },
        { startDate: new Date('2026-06-01'), status: 'active' },
      ],
    });

    const res = await GET();
    const body = await res.json();

    expect(body.periods).toHaveLength(2);
    expect(body.periods[0]).toMatchObject({ status: 'active', startDate: '2026-06-01', endDate: null });
    expect(body.periods[1]).toMatchObject({ status: 'closed', startDate: '2026-05-01', endDate: '2026-06-01' });
  });
});
