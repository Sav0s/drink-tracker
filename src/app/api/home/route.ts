import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod, formatPeriodRange } from "@/lib/period";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/**
 * Finds the most recently closed billing period that the player still owes
 * money for (has a positive total and no recorded/confirmed payment), if any.
 */
async function getUnpaidClosedPeriod(playerId: string) {
  const closedPeriod = await prisma.billingPeriod.findFirst({
    where: { status: PERIOD_STATUS.CLOSED },
    orderBy: { startDate: "desc" },
  });
  if (!closedPeriod) return null;

  const bookings = await prisma.booking.findMany({
    where: { playerId, periodId: closedPeriod.id },
    include: { drink: true },
  });
  const total_cents = bookings.reduce((s, b) => s + b.drink.priceCents, 0);
  if (total_cents <= 0) return null;

  const payment = await prisma.payment.findUnique({
    where: { playerId_periodId: { playerId, periodId: closedPeriod.id } },
  });
  if (payment?.paid) return null;

  return {
    id: closedPeriod.id,
    range: formatPeriodRange(closedPeriod.startDate, closedPeriod.endDate),
    total_cents,
    payment_instructions: closedPeriod.paymentInstructions,
  };
}

/** GET → active drinks with the current player's booking count in the active period. */
export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

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

  const closedPeriod = await getUnpaidClosedPeriod(player.id);

  return NextResponse.json({
    periodId: period?.id ?? null,
    drinks: drinks.map((d) => ({
      id: d.id,
      name: d.name,
      price_cents: d.priceCents,
      count: countByDrink.get(d.id) ?? 0,
    })),
    closedPeriod,
  });
}
