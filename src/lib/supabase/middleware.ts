import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase auth session in Next.js middleware.
 *
 * Call this at the top of your `middleware.ts` handler. It sets/refreshes
 * auth cookies so that server components always see a valid session.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { updateSession } from "@/lib/supabase/middleware";
 *
 * export async function middleware(req: NextRequest) {
 *   return await updateSession(req);
 * }
 * ```
 */
export async function updateSession(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // IMPORTANT: Do NOT remove this line — it refreshes the auth session
  // and ensures the user is authenticated.
  await supabase.auth.getUser();

  return res;
}
