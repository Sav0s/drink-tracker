import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR, PERIOD_STATUS } from "@/lib/constants";

/** POST { endDate? } → marks the active billing period done (closed). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
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

  return NextResponse.json({ ok: true });
}
