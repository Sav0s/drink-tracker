import { describe, it, expect, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { seedPlayer, seedActivePeriod } from '@/test-integration-helpers';

const getUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { PATCH } = await import('./route');

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/admin/billing-periods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('/api/admin/billing-periods/[id]', () => {
  it('PATCH rejects non-admins with 403', async () => {
    const player = await seedPlayer({ isAdmin: false });
    getUser.mockResolvedValue({ data: { user: { id: player.id } } });
    const period = await seedActivePeriod();

    const res = await PATCH(patchRequest(period.id, { paymentInstructions: 'IBAN X' }), ctx(period.id));

    expect(res.status).toBe(403);
  });

  it('PATCH updates the active period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await seedActivePeriod({ startDate: new Date('2026-07-01') });

    const res = await PATCH(
      patchRequest(period.id, { endDate: '2026-07-15', paymentInstructions: 'IBAN X' }),
      ctx(period.id)
    );

    expect(res.status).toBe(200);
    const updated = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(updated?.endDate?.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(updated?.paymentInstructions).toBe('IBAN X');
  });

  it('PATCH rejects editing a closed period', async () => {
    const admin = await seedPlayer({ isAdmin: true });
    getUser.mockResolvedValue({ data: { user: { id: admin.id } } });
    const period = await prisma.billingPeriod.create({
      data: { startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), status: 'closed' },
    });

    const res = await PATCH(patchRequest(period.id, { paymentInstructions: 'IBAN X' }), ctx(period.id));

    expect(res.status).toBe(400);
    const stillClosed = await prisma.billingPeriod.findUnique({ where: { id: period.id } });
    expect(stillClosed?.paymentInstructions).toBeNull();
  });
});
