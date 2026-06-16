import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { API_ERROR } from "@/lib/constants";

/**
 * DELETE ?drinkId=... → removes the current player's most recent booking
 * for the given drink (used for the "undo" toast on the home screen).
 */
export async function DELETE(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const drinkId = searchParams.get("drinkId");
  if (!drinkId) return NextResponse.json({ error: API_ERROR.DRINK_ID_REQUIRED }, { status: 400 });

  const last = await prisma.booking.findFirst({
    where: { playerId: player.id, drinkId },
    orderBy: { createdAt: "desc" },
  });

  if (!last) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });

  await prisma.booking.delete({ where: { id: last.id } });
  return NextResponse.json({ ok: true });
}
