import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getActivePeriod, formatPeriodRange } from "@/lib/period";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT, PERIOD_STATUS } from "@/lib/constants";

/** GET → all billing periods, newest first. */
async function getBillingPeriods() {
  const { error } = await requireAdmin();
  if (error) return error;

  const periods = await prisma.billingPeriod.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({
    periods: periods.map((p) => ({
      id: p.id,
      range: formatPeriodRange(p.startDate, p.endDate),
      status: p.status,
      paymentInstructions: p.paymentInstructions,
    })),
  });
}

/**
 * POST { startDate, endDate, paymentInstructions } → closes the current
 * active period (if any) and opens a new one.
 */
async function postBillingPeriod(request: Request) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { startDate, endDate, paymentInstructions } = await request.json();
  if (!startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });

  // getActivePeriod() (not updateMany) so we get the previous period's id
  // back to log it. Only one period is ever active at a time (app invariant),
  // so this closes the same row updateMany would have — no behavior change.
  const previousActive = await getActivePeriod();
  if (previousActive) {
    await prisma.billingPeriod.update({
      where: { id: previousActive.id },
      data: { status: PERIOD_STATUS.CLOSED, endDate: endDate ? new Date(endDate) : new Date(startDate) },
    });
    logger.info(LOG_EVENT.BILLING_PERIOD_CLOSED, {
      userId: player.id,
      meta: { periodId: previousActive.id },
    });
  }

  const period = await prisma.billingPeriod.create({
    data: {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: PERIOD_STATUS.ACTIVE,
      paymentInstructions: paymentInstructions ?? null,
    },
  });

  logger.info(LOG_EVENT.BILLING_PERIOD_OPENED, {
    userId: player.id,
    meta: { periodId: period.id, startDate, endDate: endDate ?? null },
  });

  return NextResponse.json({ id: period.id });
}

export const GET = withErrorLogging("GET /api/admin/billing-periods", getBillingPeriods);
export const POST = withErrorLogging("POST /api/admin/billing-periods", postBillingPeriod);
