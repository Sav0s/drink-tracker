import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatPeriodRange, getActivePeriod } from "@/lib/period";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** GET → all billing periods, newest first. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const periods = await prisma.billingPeriod.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({
    periods: periods.map((p) => ({
      id: p.id,
      range: formatPeriodRange(p.startDate, p.endDate),
      status: p.status,
      paymentInstructions: p.paymentInstructions,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate ? p.endDate.toISOString().slice(0, 10) : null,
    })),
  });
}

/**
 * POST { startDate, endDate, paymentInstructions } → opens a new active
 * period. Fails with 409 if one is already active — the admin must mark
 * it done (POST .../[id]/close) first.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { startDate, endDate, paymentInstructions } = await request.json();
  if (!startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });

  const activePeriod = await getActivePeriod();
  if (activePeriod) {
    return NextResponse.json({ error: API_ERROR.ACTIVE_PERIOD_EXISTS }, { status: 409 });
  }

  const period = await prisma.billingPeriod.create({
    data: {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: PERIOD_STATUS.ACTIVE,
      paymentInstructions: paymentInstructions ?? null,
    },
  });

  return NextResponse.json({ id: period.id });
}
