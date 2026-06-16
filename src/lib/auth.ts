import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";

/** Returns the current logged-in Player (DB row), or null if not authenticated / not found. */
export async function getCurrentPlayer(): Promise<Player | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.player.findUnique({ where: { id: user.id } });
}
