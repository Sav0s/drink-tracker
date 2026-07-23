import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// POST /api/test/session  { userId, isAdmin }
// Creates/upserts the test user, verifies an OTP server-side, and returns the
// raw Supabase session so that globalSetup can encode it and inject it into the
// browser context via context.addCookies() — much more reliable than trying
// to pass session cookies through a response's Set-Cookie headers.
export async function POST(request: Request) {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  const { userId, isAdmin } = await request.json();
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const email = `${userId}@e2e.test`;

  try {
    const admin = createAdminClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Determine the real Supabase UUID for this test user. We try to create the
    // user with our desired ID first; if the email is already taken (Supabase
    // auth users persist across CI runs while the local DB is fresh), fall back
    // to a getUserByEmail lookup to get the real UUID assigned by Supabase.
    let actualUserId: string;
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      id: userId,
      email,
      email_confirm: true,
    });
    if (createError) {
      console.log(`[session ${userId}] createUser: ${createError.message} — looking up real UUID`);
      const { data: existingData, error: lookupError } = await admin.auth.admin.getUserByEmail(email);
      if (lookupError || !existingData?.user) {
        const msg = lookupError?.message ?? 'getUserByEmail returned no user';
        console.error(`[session ${userId}] getUserByEmail failed: ${msg}`);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
      actualUserId = existingData.user.id;
      console.log(`[session ${userId}] Existing user — real UUID: ${actualUserId}`);
    } else {
      actualUserId = createdUser?.user?.id ?? userId;
      console.log(`[session ${userId}] Created new user — UUID: ${actualUserId}`);
    }

    // Upsert the player with the REAL Supabase UUID and mark as onboarded so
    // the first-visit welcome modal doesn't block E2E tests.
    await prisma.player.upsert({
      where: { id: actualUserId },
      update: { isAdmin },
      create: { id: actualUserId, name: `E2E ${isAdmin ? 'Admin' : 'Player'}`, isAdmin },
    });
    await prisma.$executeRaw`UPDATE players SET onboarded_at = NOW() WHERE id = ${actualUserId}`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      const msg = linkError?.message ?? 'generateLink returned no hashed_token';
      console.error(`[session ${userId}] generateLink failed: ${msg}`);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Verify the OTP server-side. We don't need setAll to fire — we read the
    // session directly from the verifyOtp return value.
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: { getAll: () => [], setAll: () => {} },
    });

    const { data, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    });

    if (otpError || !data.session) {
      const msg = otpError?.message ?? 'verifyOtp returned no session';
      console.error(`[session ${userId}] verifyOtp failed: ${msg}`);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    console.log(`[session ${userId}] session ok — JWT user.id: ${data.session.user.id} / actualUserId: ${actualUserId}`);
    return NextResponse.json({ session: data.session, actualUserId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[session ${userId}] Unexpected error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
