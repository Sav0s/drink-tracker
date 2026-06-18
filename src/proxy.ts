import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, PROTECTED_ROUTES } from "@/lib/constants";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect the old /profile path to its new home at /bookings (renamed route).
  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return NextResponse.redirect(new URL(ROUTES.BOOKINGS, request.url));
  }

  // Redirect unauthenticated users to login
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (!user && isProtected) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));
  }

  // Redirect authenticated users away from login
  if (user && pathname === ROUTES.LOGIN) {
    return NextResponse.redirect(new URL(ROUTES.HOME, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/callback).*)"],
};
