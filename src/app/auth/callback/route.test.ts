import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const exchangeCodeForSession = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser, exchangeCodeForSession } }),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { player: { findUnique, create } } }));
vi.mock('@/lib/logger');

const { GET } = await import('./route');
const { logger } = await import('@/lib/logger');

function request(url: string) {
  return new Request(url);
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    getUser.mockReset();
    exchangeCodeForSession.mockReset();
    findUnique.mockReset();
    create.mockReset();
    vi.mocked(logger.info).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.error).mockReset();
  });

  it('logs auth_success with the flow and isAdmin for a successful code exchange, existing player', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com', user_metadata: {} } } });
    findUnique.mockResolvedValue({ id: 'user-1', name: 'A', isAdmin: false });

    const res = await GET(request('http://localhost/auth/callback?code=abc'));

    expect(res.headers.get('location')).toContain('/home');
    expect(logger.info).toHaveBeenCalledWith('auth_success', {
      userId: 'user-1',
      meta: { flow: 'code_exchange', isAdmin: false },
    });
  });

  it('logs auth_success with flow "otp" when there is no code param', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-2', email: 'b@c.com', user_metadata: {} } } });
    findUnique.mockResolvedValue({ id: 'user-2', name: 'B', isAdmin: false });

    await GET(request('http://localhost/auth/callback'));

    expect(logger.info).toHaveBeenCalledWith('auth_success', {
      userId: 'user-2',
      meta: { flow: 'otp', isAdmin: false },
    });
  });

  it('logs auth_failure with reason exchange_failed when the code exchange errors, and redirects to /login', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } });

    const res = await GET(request('http://localhost/auth/callback?code=bad'));

    expect(res.headers.get('location')).toContain('/login?error=auth');
    expect(logger.warn).toHaveBeenCalledWith('auth_failure', {
      meta: { reason: 'exchange_failed', message: 'bad code' },
    });
  });

  it('logs auth_failure with reason no_user when there is no session user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(request('http://localhost/auth/callback'));

    expect(res.headers.get('location')).toContain('/login?error=nouser');
    expect(logger.warn).toHaveBeenCalledWith('auth_failure', { meta: { reason: 'no_user' } });
  });

  it('logs server_error and redirects to /login?error=callback on an unexpected exception', async () => {
    getUser.mockRejectedValue(new Error('db down'));

    const res = await GET(request('http://localhost/auth/callback'));

    expect(res.headers.get('location')).toContain('/login?error=callback');
    expect(logger.error).toHaveBeenCalledWith('server_error', {
      meta: { route: 'GET /auth/callback', message: 'db down' },
    });
  });
});
