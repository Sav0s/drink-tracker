import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { API_ERROR } from "@/lib/constants";

export async function GET() {
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
