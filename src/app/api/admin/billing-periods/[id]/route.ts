import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** PATCH { startDate?, endDate?, paymentInstructions? } → updates the active billing period. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const period = await prisma.billingPeriod.findUnique({ where: { id } });
  if (!period) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });
  if (period.status !== PERIOD_STATUS.ACTIVE) {
    return NextResponse.json({ error: API_ERROR.PERIOD_NOT_ACTIVE }, { status: 400 });
  }

  const data: { startDate?: Date; endDate?: Date | null; paymentInstructions?: string | null } = {};
  if ("startDate" in body) {
    if (!body.startDate) return NextResponse.json({ error: API_ERROR.START_DATE_REQUIRED }, { status: 400 });
    data.startDate = new Date(body.startDate);
  }
  if ("endDate" in body) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }
  if ("paymentInstructions" in body) {
    data.paymentInstructions = body.paymentInstructions || null;
  }

  const nextStartDate = data.startDate ?? period.startDate;
  const nextEndDate = "endDate" in data ? data.endDate : period.endDate;
  if (nextEndDate && nextEndDate < nextStartDate) {
    return NextResponse.json({ error: API_ERROR.END_DATE_BEFORE_START }, { status: 400 });
  }

  await prisma.billingPeriod.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
