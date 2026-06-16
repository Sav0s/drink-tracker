import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";
import { formatPeriodRange } from "@/lib/period";

async function requireAdmin() {
  const player = await getCurrentPlayer();
  if (!player) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!player.isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { player };
}

/** GET → all billing periods, newest first. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const periods = await prisma.billingPeriod.findMany({ orderBy: { startDate: "desc" } });
  return NextResponse.json({
    periods: periods.map((p) => ({
      id: p.id,
      range: formatPeriodRange(p.startDate, p.endDate),
      status: p.status === "active" ? "aktiv" : "abgeschlossen",
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
  if (!startDate) return NextResponse.json({ error: "startDate required" }, { status: 400 });

  await prisma.billingPeriod.updateMany({
    where: { status: "active" },
    data: { status: "closed", endDate: endDate ? new Date(endDate) : new Date(startDate) },
  });

  const period = await prisma.billingPeriod.create({
    data: {
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: "active",
      paymentInstructions: paymentInstructions ?? null,
    },
  });

  return NextResponse.json({ id: period.id });
}
