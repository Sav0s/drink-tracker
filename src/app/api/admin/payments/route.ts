import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";

async function requireAdmin() {
  const player = await getCurrentPlayer();
  if (!player) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!player.isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { player };
}

/** PATCH { playerId, periodId, paid } → upserts a player's payment status for a period. */
export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { playerId, periodId, paid } = await request.json();
  if (!playerId || !periodId || typeof paid !== "boolean") {
    return NextResponse.json({ error: "playerId, periodId, paid required" }, { status: 400 });
  }

  await prisma.payment.upsert({
    where: { playerId_periodId: { playerId, periodId } },
    update: { paid, paidAt: paid ? new Date() : null },
    create: { playerId, periodId, paid, paidAt: paid ? new Date() : null },
  });

  return NextResponse.json({ ok: true });
}
