import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT, PERIOD_STATUS } from "@/lib/constants";

/** POST { endDate? } → marks the active billing period done (closed). */
async function closeBillingPeriod(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const { endDate } = await request.json();

  const period = await prisma.billingPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });
  if (period.status !== PERIOD_STATUS.ACTIVE) {
    return NextResponse.json({ error: API_ERROR.PERIOD_NOT_ACTIVE }, { status: 400 });
  }

  await prisma.billingPeriod.update({
    where: { id },
    data: {
      status: PERIOD_STATUS.CLOSED,
      endDate: endDate ? new Date(endDate) : (period.endDate ?? new Date()),
    },
  });

  logger.info(LOG_EVENT.BILLING_PERIOD_CLOSED, {
    userId: player.id,
    meta: { periodId: id },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging("POST /api/admin/billing-periods/[id]/close", closeBillingPeriod);
