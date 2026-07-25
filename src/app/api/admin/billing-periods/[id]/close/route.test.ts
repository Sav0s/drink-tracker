import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { billingPeriod: { findUnique, update } } }));

const { POST } = await import('./route');

function closeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods/period-1/close', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/admin/billing-periods/[id]/close', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findUnique.mockReset();
    update.mockReset();
  });

  it('closes an active period using the sent endDate', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: null });
    update.mockResolvedValue({});

    const res = await POST(closeRequest({ endDate: '2026-07-20' }), ctx('period-1'));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: 'closed', endDate: new Date('2026-07-20') },
    });
  });

  it('keeps the existing endDate when none is sent and one is already set', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: new Date('2026-07-05') });
    update.mockResolvedValue({});

    await POST(closeRequest({ endDate: null }), ctx('period-1'));

    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { status: 'closed', endDate: new Date('2026-07-05') },
    });
  });

  it('defaults endDate to today when none is sent and none already exists', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'active', endDate: null });
    update.mockResolvedValue({});

    const before = new Date();
    await POST(closeRequest({ endDate: null }), ctx('period-1'));
    const after = new Date();

    const calledEndDate = update.mock.calls[0][0].data.endDate as Date;
    expect(calledEndDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(calledEndDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('rejects with 400 when the target period is already closed', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({ id: 'period-1', status: 'closed', endDate: new Date('2026-07-01') });

    const res = await POST(closeRequest({ endDate: null }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
