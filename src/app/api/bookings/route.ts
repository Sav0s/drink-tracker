import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { getActivePeriod } from "@/lib/period";

/** POST { drinkId } → books one drink for the current player in the active period. */
export async function POST(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { drinkId } = await request.json();
  if (!drinkId) return NextResponse.json({ error: "drinkId required" }, { status: 400 });

  const period = await getActivePeriod();
  if (!period) return NextResponse.json({ error: "No active billing period" }, { status: 409 });

  const booking = await prisma.booking.create({
    data: { playerId: player.id, drinkId, periodId: period.id },
  });

  return NextResponse.json({ id: booking.id });
}
