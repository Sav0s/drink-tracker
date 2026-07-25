import { describe, it, expect, vi, beforeEach } from 'vitest';

const getCurrentPlayer = vi.fn();
const upsert = vi.fn();

vi.mock('@/lib/auth', () => ({ getCurrentPlayer }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { upsert } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import('./route');
const { logger } = await import('@/lib/logger');

function postRequest(body: unknown) {
  return new Request('http://localhost/api/payments', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/payments', () => {
  beforeEach(() => {
    getCurrentPlayer.mockReset();
    upsert.mockReset();
    vi.mocked(logger.info).mockReset();
  });

  it('logs payment_self_marked with the player\'s own id when paid is true', async () => {
    getCurrentPlayer.mockResolvedValue({ id: 'player-1', isAdmin: false });
    upsert.mockResolvedValue({});

    const res = await POST(postRequest({ periodId: 'period-1', paid: true }));

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith('payment_self_marked', {
      userId: 'player-1',
      meta: { periodId: 'period-1' },
    });
  });

  it('logs payment_self_reset when paid is false', async () => {
    getCurrentPlayer.mockResolvedValue({ id: 'player-1', isAdmin: false });
    upsert.mockResolvedValue({});

    await POST(postRequest({ periodId: 'period-1', paid: false }));

    expect(logger.info).toHaveBeenCalledWith('payment_self_reset', {
      userId: 'player-1',
      meta: { periodId: 'period-1' },
    });
  });

  it('does not upsert or log when there is no logged-in player', async () => {
    getCurrentPlayer.mockResolvedValue(null);

    const res = await POST(postRequest({ periodId: 'period-1', paid: true }));

    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
