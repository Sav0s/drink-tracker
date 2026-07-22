import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

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

  const supabase = await createServerSupabaseClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
