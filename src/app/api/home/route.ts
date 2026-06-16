import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod } from "@/lib/period";

/** GET → active drinks with the current player's booking count in the active period. */
export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const drinks = await prisma.drink.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const period = await getActivePeriod();

  const bookings = period
    ? await prisma.booking.findMany({
        where: { playerId: player.id, periodId: period.id },
      })
    : [];

  const countByDrink = new Map<string, number>();
  for (const b of bookings) {
    countByDrink.set(b.drinkId, (countByDrink.get(b.drinkId) ?? 0) + 1);
  }

  return NextResponse.json({
    periodId: period?.id ?? null,
    drinks: drinks.map((d) => ({
      id: d.id,
      name: d.name,
      price_cents: d.priceCents,
      count: countByDrink.get(d.id) ?? 0,
    })),
  });
}
