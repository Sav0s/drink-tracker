import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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

  // Generate a magic link that redirects to our local auth callback.
  // The browser will navigate to this URL; Supabase verifies the token,
  // then redirects to /auth/callback which calls exchangeCodeForSession
  // and sets auth cookies via a navigation response (more reliable than
  // setting cookies from a JSON API response).
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: `${userId}@e2e.test`,
    options: { redirectTo: 'http://localhost:3000/auth/callback' },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: linkError?.message ?? 'generateLink failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ action_link: linkData.properties.action_link });
}
