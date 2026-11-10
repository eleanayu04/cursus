import { NextResponse, type NextRequest } from "next/server";
import { fetchSession, usesDevUser } from "@/lib/session";

const SIGN_IN = "/auth/sign-in";

// Sign-in pages, and Floo's /api/auth in case a request for it reaches us.
const isPublic = (path: string) =>
  path === "/auth" || path.startsWith("/auth/") || path === "/api/auth" || path.startsWith("/api/auth/");

// The app is public at the Floo level, so this is what keeps it behind sign-in.
// Pages and server actions also check via requireProfile().
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (usesDevUser() || isPublic(pathname)) return NextResponse.next();

  const { session, setCookies } = await fetchSession(request.headers.get("cookie") ?? "");

  let response: NextResponse;
  if (session) {
    response = NextResponse.next();
  } else {
    // Keep the path, so invite links still land where they point once the
    // person has signed in. Next rejects a relative Location here.
    const target = new URL(SIGN_IN, request.url);
    if (request.method === "GET" && pathname !== "/") target.searchParams.set("next", pathname + search);
    response = NextResponse.redirect(target);
  }
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

export const config = {
  // /health stays out so Floo's health check passes with no session. The icons
  // stay out so the browser tab shows them on the sign-in page too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|health$).*)"],
};
