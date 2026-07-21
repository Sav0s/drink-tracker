import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    player: { findUnique },
  },
}));

// Imported after the mocks above so the module under test picks them up.
const { getCurrentPlayer, requireAdmin } = await import('./auth');

describe('getCurrentPlayer', () => {
  beforeEach(() => {
    getUser.mockReset();
    findUnique.mockReset();
  });

  it('returns null when there is no authenticated Supabase user', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const player = await getCurrentPlayer();

    expect(player).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('looks up the Player row by the Supabase user id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    findUnique.mockResolvedValue({ id: 'user-1', name: 'Fabi', isAdmin: false });

    const player = await getCurrentPlayer();

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(player).toEqual({ id: 'user-1', name: 'Fabi', isAdmin: false });
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    getUser.mockReset();
    findUnique.mockReset();
  });

  it('returns a 401 when nobody is logged in', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await requireAdmin();

    expect(result.player).toBeUndefined();
    expect(result.error?.status).toBe(401);
    const body = await result.error?.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns a 403 when the player is not an admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    findUnique.mockResolvedValue({ id: 'user-1', name: 'Fabi', isAdmin: false });

    const result = await requireAdmin();

    expect(result.player).toBeUndefined();
    expect(result.error?.status).toBe(403);
    const body = await result.error?.json();
    expect(body).toEqual({ error: 'Forbidden' });
  });

  it('returns the player when they are an admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } });
    findUnique.mockResolvedValue({ id: 'admin-1', name: 'Admin', isAdmin: true });

    const result = await requireAdmin();

    expect(result.error).toBeUndefined();
    expect(result.player).toEqual({ id: 'admin-1', name: 'Admin', isAdmin: true });
  });
});
