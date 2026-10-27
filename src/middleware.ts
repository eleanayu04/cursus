import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie → sign in. The cookie itself is validated
// against the database in requireProfile() on each page.
export function middleware(req: NextRequest) {
  if (req.cookies.has("cursus_session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.search = "";
  url.pathname = "/login";
  if (req.nextUrl.pathname !== "/") {
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|health|_next/|favicon.ico|icon.svg).*)"],
};
