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

  try {
    await prisma.player.upsert({
      where: { id: userId },
      update: { isAdmin },
      create: { id: userId, name: `E2E ${isAdmin ? 'Admin' : 'Player'}`, isAdmin },
    });

    const admin = createAdminClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // createUser is idempotent — ignore "already registered" errors since
    // Supabase auth users persist across CI runs while the local DB is fresh.
    const { error: createError } = await admin.auth.admin.createUser({
      id: userId,
      email: `${userId}@e2e.test`,
      email_confirm: true,
    });
    if (createError) {
      console.log(`[session ${userId}] createUser: ${createError.message} (continuing)`);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${userId}@e2e.test`,
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

    console.log(`[session ${userId}] session ok — user.id in JWT: ${data.session.user.id} (expected: ${userId})`);
    if (data.session.user.id !== userId) {
      console.error(`[session ${userId}] MISMATCH: Supabase user has different UUID. DB player lookup will fail.`);
    }
    return NextResponse.json({ session: data.session });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[session ${userId}] Unexpected error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
