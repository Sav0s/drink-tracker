import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatPeriodRange } from "@/lib/period";
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
    })),
  });
}

/**
 * POST { startDate, endDate, paymentInstructions } → closes the current
 * active period (if any) and opens a new one.
 */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { startDate, endDate, paymentInstructions } = await request.json();
  if (!startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });

  await prisma.billingPeriod.updateMany({
    where: { status: PERIOD_STATUS.ACTIVE },
    data: { status: PERIOD_STATUS.CLOSED, endDate: endDate ? new Date(endDate) : new Date(startDate) },
  });

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
