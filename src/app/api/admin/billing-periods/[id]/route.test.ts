import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findUnique = vi.fn();
const update = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { billingPeriod: { findUnique, update } } }));

const { PATCH } = await import('./route');

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods/period-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/billing-periods/[id]', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findUnique.mockReset();
    update.mockReset();
  });

  it('updates only the sent fields on an active period', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'active', startDate: new Date('2026-07-01'), endDate: null, paymentInstructions: null,
    });
    update.mockResolvedValue({});

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('period-1'));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { paymentInstructions: 'IBAN X' },
    });
  });

  it('rejects with 400 when the target period is not active', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'closed', startDate: new Date('2026-06-01'), endDate: new Date('2026-07-01'), paymentInstructions: null,
    });

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the resulting endDate is before startDate', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue({
      id: 'period-1', status: 'active', startDate: new Date('2026-07-10'), endDate: null, paymentInstructions: null,
    });

    const res = await PATCH(patchRequest({ endDate: '2026-07-01' }), ctx('period-1'));

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 404 when the period does not exist', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findUnique.mockResolvedValue(null);

    const res = await PATCH(patchRequest({ paymentInstructions: 'IBAN X' }), ctx('missing'));

    expect(res.status).toBe(404);
  });
});
