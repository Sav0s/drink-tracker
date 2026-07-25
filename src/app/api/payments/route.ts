import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** POST { periodId, paid } → the current player marks their own payment for a period. */
async function postPayment(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { periodId, paid } = await request.json();
  if (!periodId || typeof paid !== "boolean") {
    return NextResponse.json({ error: API_ERROR.PAYMENT_FIELDS_REQUIRED }, { status: 400 });
  }

  await prisma.payment.upsert({
    where: { playerId_periodId: { playerId: player.id, periodId } },
    update: { paid, paidAt: paid ? new Date() : null },
    create: { playerId: player.id, periodId, paid, paidAt: paid ? new Date() : null },
  });

  logger.info(paid ? LOG_EVENT.PAYMENT_SELF_MARKED : LOG_EVENT.PAYMENT_SELF_RESET, {
    userId: player.id,
    meta: { periodId },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging("POST /api/payments", postPayment);
