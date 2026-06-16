import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { API_ERROR } from "@/lib/constants";
import type { Player } from "@prisma/client";

/** Returns the current logged-in Player (DB row), or null if not authenticated / not found. */
export async function getCurrentPlayer(): Promise<Player | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.player.findUnique({ where: { id: user.id } });
}

/**
 * Guard for admin-only API routes. Returns `{ error }` (a ready-to-return
 * NextResponse) if the request isn't from a logged-in admin, otherwise `{ player }`.
 */
export async function requireAdmin(): Promise<
  { player: Player; error?: undefined } | { player?: undefined; error: NextResponse }
> {
  const player = await getCurrentPlayer();
  if (!player) {
    return { error: NextResponse.json({ error: API_ERROR.UNAUTHORIZED }, { status: 401 }) };
  }
  if (!player.isAdmin) {
    return { error: NextResponse.json({ error: API_ERROR.FORBIDDEN }, { status: 403 }) };
  }
  return { player };
}
