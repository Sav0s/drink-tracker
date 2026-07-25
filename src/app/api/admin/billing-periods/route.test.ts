import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAdmin = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const create = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAdmin }));
vi.mock('@/lib/prisma', () => ({
  prisma: { billingPeriod: { findFirst, update, create, findMany: vi.fn() } },
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/admin/billing-periods', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/admin/billing-periods', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findFirst.mockReset();
    update.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('closes the previous active period by id, then logs billing_period_closed and billing_period_opened', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue({ id: 'old-period' });
    update.mockResolvedValue({});
    create.mockResolvedValue({ id: 'new-period' });

    const res = await POST(postRequest({ startDate: '2026-07-01', endDate: null, paymentInstructions: 'IBAN X' }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'old-period' },
      data: { status: 'closed', endDate: new Date('2026-07-01') },
    });
    expect(logger.info).toHaveBeenNthCalledWith(1, 'billing_period_closed', {
      userId: 'admin-1',
      meta: { periodId: 'old-period' },
    });
    expect(logger.info).toHaveBeenNthCalledWith(2, 'billing_period_opened', {
      userId: 'admin-1',
      meta: { periodId: 'new-period', startDate: '2026-07-01', endDate: null },
    });
  });

  it('skips billing_period_closed when there was no active period', async () => {
    requireAdmin.mockResolvedValue({ player: { id: 'admin-1', isAdmin: true } });
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'new-period' });

    await POST(postRequest({ startDate: '2026-07-01' }));

    expect(update).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('billing_period_opened', {
      userId: 'admin-1',
      meta: { periodId: 'new-period', startDate: '2026-07-01', endDate: null },
    });
  });
});
