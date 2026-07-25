import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { LOG_EVENT } from "@/lib/constants";

/** PATCH { name?, price_cents?, active? } → updates a drink. */
async function patchDrink(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const data: { name?: string; priceCents?: number; active?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.price_cents === "number") data.priceCents = body.price_cents;
  if (typeof body.active === "boolean") data.active = body.active;

  await prisma.drink.update({ where: { id }, data });

  logger.info(LOG_EVENT.DRINK_UPDATED, { userId: player.id, meta: { drinkId: id, changes: data } });

  return NextResponse.json({ ok: true });
}

export const PATCH = withErrorLogging("PATCH /api/admin/drinks/[id]", patchDrink);
