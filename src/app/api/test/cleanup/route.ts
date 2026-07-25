import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertDisposableDatabase } from '@/lib/assertDisposableDatabase';

export async function POST() {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  // Defense in depth: PLAYWRIGHT_TEST=true alone isn't enough to trust this
  // route with deleteMany() below — if that flag ever leaked into a real
  // environment, this would still refuse to run against a non-disposable DB.
  assertDisposableDatabase(process.env.DATABASE_URL!);

  // Find all E2E test player rows (name starts with "E2E"). Their UUIDs may
  // differ from our hardcoded PLAYER_ID/ADMIN_ID constants if Supabase already
  // had users for those emails from a previous run and assigned different UUIDs.
  const testPlayers = await prisma.player.findMany({
    where: { name: { startsWith: 'E2E' } },
    select: { id: true },
  });
  const testPlayerIds = testPlayers.map(p => p.id);

  // Payments/bookings are scoped to the E2E test players so a run never
  // touches another player's data. Billing periods have no such per-row
  // marker (specs open/close whichever period is active), so this instead
  // relies entirely on assertDisposableDatabase() above — this route only
  // ever runs against a database where wiping every period is intentional.
  if (testPlayerIds.length > 0) {
    await prisma.payment.deleteMany({ where: { playerId: { in: testPlayerIds } } });
    await prisma.booking.deleteMany({ where: { playerId: { in: testPlayerIds } } });
  }
  await prisma.billingPeriod.deleteMany({});
  if (testPlayerIds.length > 0) {
    await prisma.player.deleteMany({ where: { id: { in: testPlayerIds } } });
  }
  await prisma.drink.deleteMany({ where: { name: { startsWith: 'E2E' } } });

  return NextResponse.json({ ok: true });
}
