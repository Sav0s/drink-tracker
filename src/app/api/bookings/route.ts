import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod, formatPeriodRange, formatDateShort } from "@/lib/period";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR, PERIOD_STATUS, PROFILE_STATUS } from "@/lib/constants";

/** GET → billing periods relevant to the current player, with their bookings + payment status. */
async function getBookings() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

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
      period.status === PERIOD_STATUS.ACTIVE
        ? PROFILE_STATUS.ACTIVE
        : paidByPeriod.get(period.id)
          ? PROFILE_STATUS.PAID
          : PROFILE_STATUS.PENDING;

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

/** POST { drinkId } → books one drink for the current player in the active period. */
async function postBooking(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { drinkId } = await request.json();
  if (!drinkId) return NextResponse.json({ error: API_ERROR.DRINK_ID_REQUIRED }, { status: 400 });

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ error: API_ERROR.NO_ACTIVE_PERIOD }, { status: 409 });

  const booking = await prisma.booking.create({
    data: { playerId: player.id, drinkId, periodId: period.id },
  });

  return NextResponse.json({ id: booking.id });
}

export const GET = withErrorLogging("GET /api/bookings", getBookings);
export const POST = withErrorLogging("POST /api/bookings", postBooking);
