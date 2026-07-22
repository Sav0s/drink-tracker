import { prisma } from '@/lib/prisma';

/**
 * Shared fixtures for integration tests. These write directly to the real
 * test database via Prisma — no mocking. Pair with mocking
 * '@/lib/supabase/server' (or 'client') to stub only the external auth
 * provider, so `getCurrentPlayer()` / `requireAdmin()` still run for real
 * against the seeded player row.
 */

export async function seedPlayer(
  overrides: Partial<{ id: string; name: string; isAdmin: boolean }> = {}
) {
  const id = overrides.id ?? crypto.randomUUID();
  return prisma.player.create({
    data: {
      id,
      name: overrides.name ?? `Test Player ${id.slice(0, 8)}`,
      isAdmin: overrides.isAdmin ?? false,
    },
  });
}

export async function seedDrink(
  overrides: Partial<{ name: string; priceCents: number; active: boolean }> = {}
) {
  return prisma.drink.create({
    data: {
      name: overrides.name ?? 'Bier',
      priceCents: overrides.priceCents ?? 150,
      active: overrides.active ?? true,
    },
  });
}

export async function seedActivePeriod(overrides: Partial<{ startDate: Date }> = {}) {
  return prisma.billingPeriod.create({
    data: {
      startDate: overrides.startDate ?? new Date('2026-07-01'),
      status: 'active',
    },
  });
}
