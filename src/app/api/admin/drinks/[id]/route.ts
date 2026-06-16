import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPlayer } from "@/lib/auth";

async function requireAdmin() {
  const player = await getCurrentPlayer();
  if (!player) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!player.isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { player };
}

/** PATCH { name?, price_cents?, active? } → updates a drink. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  const data: { name?: string; priceCents?: number; active?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.price_cents === "number") data.priceCents = body.price_cents;
  if (typeof body.active === "boolean") data.active = body.active;

  await prisma.drink.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
