import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger, toErrorMessage } from "@/lib/logger";
import { ROUTES, DEFAULT_PLAYER_NAME, LOG_EVENT } from "@/lib/constants";

/** Creates the player row, ensuring the @unique name doesn't collide with an existing one. */
async function ensurePlayer(id: string, baseName: string) {
  const existing = await prisma.player.findUnique({ where: { id } });
  if (existing) return existing;

  const base = baseName.trim() || DEFAULT_PLAYER_NAME;

  // Try the plain name first, then a few suffixed variants, then fall back to an id-based suffix.
  const candidates = [base, `${base} (2)`, `${base} (3)`, `${base} ${id.slice(0, 4)}`];
  for (const name of candidates) {
    try {
      return await prisma.player.create({ data: { id, name } });
    } catch {
      // Most likely a unique-name violation — try the next candidate.
    }
  }
  // Last resort: guaranteed-unique name from the user id.
  return prisma.player.create({ data: { id, name: `${base} ${id.slice(0, 8)}` } });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? ROUTES.HOME;
  const flow = code ? "code_exchange" : "otp";

  try {
    const supabase = await createClient();

    if (code) {
      // OAuth / magic link flow: exchange code for session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        logger.warn(LOG_EVENT.AUTH_FAILURE, { meta: { reason: "exchange_failed", message: error.message } });
        return NextResponse.redirect(`${origin}/login?error=auth`);
      }
    }
    // No code → OTP flow: session already set by verifyOtp in the browser

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn(LOG_EVENT.AUTH_FAILURE, { meta: { reason: "no_user" } });
      return NextResponse.redirect(`${origin}/login?error=nouser`);
    }

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      DEFAULT_PLAYER_NAME;

    const player = await ensurePlayer(user.id, displayName);

    logger.info(LOG_EVENT.AUTH_SUCCESS, { userId: user.id, meta: { flow, isAdmin: player.isAdmin } });

    // Guard admin routes; route admins to their dashboard when they use the normal login.
    if (next.startsWith("/admin") && !player.isAdmin) {
      return NextResponse.redirect(`${origin}${ROUTES.HOME}`);
    }
    if (next === ROUTES.HOME && player.isAdmin) {
      return NextResponse.redirect(`${origin}${ROUTES.ADMIN_DASHBOARD}`);
    }

    return NextResponse.redirect(`${origin}${next}`);
  } catch (e) {
    const message = toErrorMessage(e);
    logger.error(LOG_EVENT.SERVER_ERROR, { meta: { route: "GET /auth/callback", message } });
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }
}
