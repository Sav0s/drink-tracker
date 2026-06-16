import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR } from "@/lib/constants";

/** PATCH { playerId, periodId, paid } → upserts a player's payment status for a period. */
export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { playerId, periodId, paid } = await request.json();
  if (!playerId || !periodId || typeof paid !== "boolean") {
    return NextResponse.json({ error: API_ERROR.PAYMENT_FIELDS_REQUIRED }, { status: 400 });
  }

  await prisma.payment.upsert({
    where: { playerId_periodId: { playerId, periodId } },
    update: { paid, paidAt: paid ? new Date() : null },
    create: { playerId, periodId, paid, paidAt: paid ? new Date() : null },
  });

  return NextResponse.json({ ok: true });
}
