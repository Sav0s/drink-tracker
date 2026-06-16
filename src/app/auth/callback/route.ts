import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ROUTES } from "@/lib/constants";

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

  const next = searchParams.get("next") ?? "/home";

  // Upsert player record
  let player = await prisma.player.findUnique({ where: { id: user.id } });

  if (!player) {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Unbekannt";

    player = await prisma.player.create({
      data: { id: user.id, name: displayName },
    });
  }

  // Guard admin routes
  if (next.startsWith("/admin") && !player.isAdmin) {
    return NextResponse.redirect(`${origin}${ROUTES.HOME}`);
  }

  // Admins signing in through the regular login land on their dashboard.
  if (next === ROUTES.HOME && player.isAdmin) {
    return NextResponse.redirect(`${origin}${ROUTES.ADMIN_DASHBOARD}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
