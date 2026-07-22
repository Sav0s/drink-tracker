import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  // Order matters: bookings/payments reference billing_periods + players + drinks
  await prisma.payment.deleteMany({
    where: { OR: [{ playerId: 'e2e-player-001' }, { playerId: 'e2e-admin-001' }] },
  });
  await prisma.booking.deleteMany({
    where: { OR: [{ playerId: 'e2e-player-001' }, { playerId: 'e2e-admin-001' }] },
  });
  await prisma.billingPeriod.deleteMany({});
  await prisma.drink.deleteMany({ where: { name: { startsWith: 'E2E' } } });

  return NextResponse.json({ ok: true });
}
