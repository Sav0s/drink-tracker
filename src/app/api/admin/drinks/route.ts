import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { logger } from "@/lib/logger";
import { API_ERROR, LOG_EVENT } from "@/lib/constants";

/** GET → all drinks (active + inactive). */
async function getDrinks() {
  const { error } = await requireAdmin();
  if (error) return error;

  const drinks = await prisma.drink.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    drinks: drinks.map((d) => ({ id: d.id, name: d.name, price_cents: d.priceCents, active: d.active })),
  });
}

/** POST { name, price_cents, active } → creates a new drink. */
async function postDrink(request: Request) {
  const { player, error } = await requireAdmin();
  if (error) return error;

  const { name, price_cents, active } = await request.json();
  if (!name || typeof price_cents !== "number") {
    return NextResponse.json({ error: API_ERROR.NAME_AND_PRICE_REQUIRED }, { status: 400 });
  }

  const drink = await prisma.drink.create({
    data: { name, priceCents: price_cents, active: active ?? true },
  });

  logger.info(LOG_EVENT.DRINK_CREATED, {
    userId: player.id,
    meta: { drinkId: drink.id, name: drink.name, price_cents: drink.priceCents, active: drink.active },
  });

  return NextResponse.json({ id: drink.id });
}

export const GET = withErrorLogging("GET /api/admin/drinks", getDrinks);
export const POST = withErrorLogging("POST /api/admin/drinks", postDrink);
