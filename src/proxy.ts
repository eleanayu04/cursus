import { NextResponse, type NextRequest } from "next/server";
import { getAuth, usesDevUser } from "@/lib/neon-auth";

const SIGN_IN = "/auth/sign-in";

// The app is public at the Floo level, so this is what keeps it behind sign-in.
// Pages and server actions also check via requireProfile().
export default async function proxy(request: NextRequest) {
  if (usesDevUser()) return NextResponse.next();

  // Sign-in, sign-up and /api/auth are public by default in the SDK.
  const response = await getAuth().middleware({ loginUrl: SIGN_IN })(request);

  // The SDK drops the path when it redirects to sign-in. Keep it, so invite
  // links still land where they point once the person has signed in.
  const location = response.headers.get("location");
  const { pathname, search } = request.nextUrl;
  if (location && request.method === "GET" && pathname !== "/" && new URL(location, request.url).pathname === SIGN_IN) {
    // Next rejects a relative Location from a proxy, so this has to be absolute.
    const target = new URL(`${SIGN_IN}?next=${encodeURIComponent(pathname + search)}`, request.url);
    const withNext = NextResponse.redirect(target, response.status);
    for (const cookie of response.headers.getSetCookie()) withNext.headers.append("set-cookie", cookie);
    return withNext;
  }
  return response;
}

export const config = {
  // /health stays out so Floo's health check passes with no session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|health$).*)"],
};
