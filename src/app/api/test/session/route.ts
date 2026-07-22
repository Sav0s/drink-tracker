import { NextResponse } from 'next/server';
import { createClient as createAdminClient, createClient as createServerClient } from '@supabase/supabase-js';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return new Response(null, { status: 404 });
  }

  const { userId, isAdmin } = await request.json();

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  await prisma.player.upsert({
    where: { id: userId },
    update: { isAdmin },
    create: { id: userId, name: `E2E ${isAdmin ? 'Admin' : 'Player'}`, isAdmin },
  });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  await admin.auth.admin.createUser({
    id: userId,
    email: `${userId}@e2e.test`,
    email_confirm: true,
  }).catch((err: unknown) => {
    if (!/already registered/i.test(String(err))) throw err;
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: `${userId}@e2e.test`,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? 'generateLink failed' },
      { status: 500 }
    );
  }

  // Build the response first so we can set cookies directly on it.
  // Using cookies().set() from next/headers is unreliable in Next.js 16 App
  // Router route handlers — cookies set that way may not appear in Set-Cookie
  // response headers. Setting them on the NextResponse object is the safe path
  // (same pattern the proxy uses).
  const response = NextResponse.json({ ok: true });

  const supabase = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 500 });
  }

  return response;
}
