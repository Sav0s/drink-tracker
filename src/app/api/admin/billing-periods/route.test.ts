import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findFirst = vi.fn();
const create = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({
  prisma: { billingPeriod: { findFirst, create, findMany: vi.fn() } },
}));
vi.mock('@/lib/logger');

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/admin/billing-periods', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findFirst.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('opens a new period and logs billing_period_opened when none is active', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'new-period' });

    const res = await POST(postRequest({ startDate: '2026-07-01', endDate: null, paymentInstructions: 'IBAN X' }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('billing_period_opened', {
      userId: 'admin-1',
      meta: { periodId: 'new-period', startDate: '2026-07-01', endDate: null },
    });
  });

  it('rejects with 409 and does not create or log when a period is already active', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue({ id: 'old-period' });

    const res = await POST(postRequest({ startDate: '2026-07-01' }));

    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
