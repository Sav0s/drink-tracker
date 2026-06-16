import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/** GET → per-member booking + payment breakdown for the given billing period. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id: periodId } = await params;

  const bookings = await prisma.booking.findMany({
    where: { periodId },
    include: { drink: true, player: true },
  });

  const payments = await prisma.payment.findMany({ where: { periodId } });
  const paidByPlayer = new Map(payments.map((p) => [p.playerId, p.paid]));

  const byPlayer = new Map<
    string,
    { id: string; name: string; count: number; total_cents: number; items: Map<string, { drink: string; count: number; price_cents: number }> }
  >();

  for (const b of bookings) {
    if (!byPlayer.has(b.playerId)) {
      byPlayer.set(b.playerId, {
        id: b.playerId,
        name: b.player.name,
        count: 0,
        total_cents: 0,
        items: new Map(),
      });
    }
    const entry = byPlayer.get(b.playerId)!;
    entry.count += 1;
    entry.total_cents += b.drink.priceCents;

    const item = entry.items.get(b.drinkId) ?? { drink: b.drink.name, count: 0, price_cents: b.drink.priceCents };
    item.count += 1;
    entry.items.set(b.drinkId, item);
  }

  const members = [...byPlayer.values()].map((m) => ({
    id: m.id,
    name: m.name,
    count: m.count,
    total_cents: m.total_cents,
    paid: paidByPlayer.get(m.id) ?? false,
    items: [...m.items.values()],
  }));

  return NextResponse.json({ members });
}
