import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";

async function requireAdmin() {
  const player = await getCurrentPlayer();
  if (!player) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!player.isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { player };
}

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
    return NextResponse.json({ error: "name and price_cents required" }, { status: 400 });
  }

  const drink = await prisma.drink.create({
    data: { name, priceCents: price_cents, active: active ?? true },
  });

  return NextResponse.json({ id: drink.id });
}
