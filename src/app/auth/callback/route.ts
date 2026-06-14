import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(`${origin}/login`);
  }

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Create player record if this is the first login
  const existingPlayer = await prisma.player.findUnique({
    where: { id: user.id },
  });

  if (!existingPlayer) {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Unbekannt";

    await prisma.player.create({
      data: {
        id: user.id,
        name: displayName,
      },
    });
  }

  return NextResponse.redirect(`${origin}/home`);
}
