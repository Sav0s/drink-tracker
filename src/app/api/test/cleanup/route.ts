import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  // Find all E2E test player rows (name starts with "E2E"). Their UUIDs may
  // differ from our hardcoded PLAYER_ID/ADMIN_ID constants if Supabase already
  // had users for those emails from a previous run and assigned different UUIDs.
  const testPlayers = await prisma.player.findMany({
    where: { name: { startsWith: 'E2E' } },
    select: { id: true },
  });
  const testPlayerIds = testPlayers.map(p => p.id);

  // Order matters: dependent rows must be deleted before their parents.
  // Payments and bookings from any player may reference billing periods, so
  // wipe them all before deleting periods.
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.billingPeriod.deleteMany({});
  if (testPlayerIds.length > 0) {
    await prisma.player.deleteMany({ where: { id: { in: testPlayerIds } } });
  }
  await prisma.drink.deleteMany({ where: { name: { startsWith: 'E2E' } } });

  return NextResponse.json({ ok: true });
}
