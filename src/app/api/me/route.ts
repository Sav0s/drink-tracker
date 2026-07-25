import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { withErrorLogging } from "@/lib/withErrorLogging";
import { API_ERROR } from "@/lib/constants";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const player = await prisma.player.findUnique({ where: { id: user.id } });

  if (!player) return NextResponse.json({ error: API_ERROR.NOT_FOUND }, { status: 404 });

  return NextResponse.json({
    id: player.id,
    name: player.name,
    isAdmin: player.isAdmin,
  });
}

/** PATCH { name, onboarded? } → updates the display name; marks the first-visit welcome done. */
async function patchMe(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 });

  const { name, onboarded } = await request.json();
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return NextResponse.json({ error: API_ERROR.NAME_REQUIRED }, { status: 400 });

  const player = await prisma.player.update({
    where: { id: user.id },
    data: { name: trimmed },
  });

  // Mark the first-visit welcome as completed (only the first time).
  // Raw SQL so this compiles before `prisma generate` adds the new column.
  if (onboarded === true) {
    await prisma.$executeRaw`UPDATE players SET onboarded_at = now() WHERE id = ${user.id} AND onboarded_at IS NULL`;
  }

  return NextResponse.json({
    id: player.id,
    name: player.name,
    isAdmin: player.isAdmin,
  });
}

export const GET = withErrorLogging("GET /api/me", getMe);
export const PATCH = withErrorLogging("PATCH /api/me", patchMe);
