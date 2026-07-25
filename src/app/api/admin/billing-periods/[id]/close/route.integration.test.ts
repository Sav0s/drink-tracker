import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { POST } = await import('./route');

function closeRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/admin/billing-periods/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/admin/billing-periods/[id]/close', () => {
  it('rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });
    const period = await seedActivePeriod();

    const res = await POST(closeRequest(period.id, { endDate: null }), ctx(period.id));

    expect(res.status).toBe(403);
  });

  it('closes the active period, leaving zero active periods', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await seedActivePeriod({ startDate: new Date('2026-07-01') });

    const res = await POST(closeRequest(period.id, { endDate: '2026-07-20' }), ctx(period.id));

    expect(res.status).toBe(200);
    const closed = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(closed?.status).toBe('closed');
    expect(closed?.endDate?.toISOString().slice(0, 10)).toBe('2026-07-20');

    const activePeriods = await prisma.billingPeriod.findMany({ where: { status: 'active' } });
    expect(activePeriods).toHaveLength(0);
  });

  it('rejects closing an already-closed period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), status: 'closed' },
    });

    const res = await POST(closeRequest(period.id, { endDate: null }), ctx(period.id));

    expect(res.status).toBe(400);
  });
});
