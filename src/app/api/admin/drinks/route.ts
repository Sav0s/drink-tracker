import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { API_ERROR } from "@/lib/constants";

/** GET → all drinks (active + inactive). */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const drinks = await prisma.drink.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    drinks: drinks.map((d) => ({ id: d.id, name: d.name, price_cents: d.priceCents, active: d.active })),
  });
}

/** POST { name, price_cents, active } → creates a new drink. */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { name, price_cents, active } = await request.json();
  if (!name || typeof price_cents !== "number") {
    return NextResponse.json({ error: API_ERROR.NAME_AND_PRICE_REQUIRED }, { status: 400 });
  }

  const drink = await prisma.drink.create({
    data: { name, priceCents: price_cents, active: active ?? true },
  });

  return NextResponse.json({ id: drink.id });
}
