import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// GET /api/test/session?userId=...&isAdmin=true|false
// Browser navigates here; the route verifies an OTP server-side, sets auth
// cookies directly on the redirect response, then sends the browser to /home
// or /admin/dashboard. Avoids page.request.post() which doesn't share cookies
// with the browser context.
export async function GET(request: NextRequest) {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const userId  = searchParams.get('userId');
  const isAdmin = searchParams.get('isAdmin') === 'true';

  if (!userId) {
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

    // Ignore createUser errors — the user may already exist in Supabase from a
    // previous run (Supabase users persist across CI runs unlike the local DB).
    const { error: createError } = await admin.auth.admin.createUser({
      id: userId,
      email: `${userId}@e2e.test`,
      email_confirm: true,
    });
    if (createError) {
      console.log(`[session ${userId}] createUser result (may be expected): ${createError.message}`);
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

    console.log(`[session ${userId}] generateLink ok, verifying OTP…`);

    const cookieEntries: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => [],
        setAll: (toSet) => {
          cookieEntries.push(...toSet);
        },
      },
    });

    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    });

    if (otpError) {
      console.error(`[session ${userId}] verifyOtp failed: ${otpError.message}`);
      return NextResponse.json({ error: otpError.message }, { status: 500 });
    }

    console.log(`[session ${userId}] verifyOtp ok, cookies set: ${cookieEntries.map(c => c.name).join(', ') || 'NONE'}`);

    const dest = `${origin}${isAdmin ? '/admin/dashboard' : '/home'}`;
    const response = NextResponse.redirect(dest);
    cookieEntries.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    );
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[session ${userId}] Unexpected error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
