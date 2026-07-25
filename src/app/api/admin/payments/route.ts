import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** PATCH { playerId, periodId, paid } → upserts a player's payment status for a period. */
async function patchPayment(request: Request) {
  const { player, error } = await requireAdmin();
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

  logger.info(paid ? LOG_EVENT.PAYMENT_MARKED : LOG_EVENT.PAYMENT_RESET, {
    userId: player.id,
    meta: { playerId, periodId },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorLogging("PATCH /api/admin/payments", patchPayment);
