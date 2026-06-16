import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { formatPeriodRange, formatDateShort } from "@/lib/period";

/** GET → billing periods relevant to the current player, with their bookings + payment status. */
export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { playerId: player.id },
    include: { drink: true },
    orderBy: { createdAt: "desc" },
  });

  const periodIds = [...new Set(bookings.map((b) => b.periodId))];
  if (periodIds.length === 0) return NextResponse.json({ periods: [] });

  const periods = await prisma.billingPeriod.findMany({
    where: { id: { in: periodIds } },
    orderBy: { startDate: "desc" },
  });

  const payments = await prisma.payment.findMany({
    where: { playerId: player.id, periodId: { in: periodIds } },
  });
  const paidByPeriod = new Map(payments.map((p) => [p.periodId, p.paid]));

  const result = periods.map((period) => {
    const periodBookings = bookings.filter((b) => b.periodId === period.id);
    const total_cents = periodBookings.reduce((s, b) => s + b.drink.priceCents, 0);

    const status =
      period.status === "active" ? "aktiv" : paidByPeriod.get(period.id) ? "bezahlt" : "ausstehend";

    return {
      id: period.id,
      range: formatPeriodRange(period.startDate, period.endDate),
      status,
      count: periodBookings.length,
      total_cents,
      rows: periodBookings.map((b) => ({
        date: formatDateShort(b.createdAt),
        drink: b.drink.name,
        price_cents: b.drink.priceCents,
      })),
    };
  });

  return NextResponse.json({ periods: result });
}
