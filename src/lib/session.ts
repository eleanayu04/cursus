// Floo User accounts: Floo runs the sign-in service (Better Auth) at /api/auth on
// Cursus's own domain and stores users in the floo_auth schema of our Postgres.
// The browser signs in through src/lib/auth-client.ts. The server only asks Floo
// whose session cookie a request carries.

export type FlooUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
};
export type FlooSession = { session: { id: string; expiresAt: string }; user: FlooUser };

/**
 * Local development has no sign-in service, so requests act as DEV_USER_EMAIL.
 * Never true in a production build, so a missing FLOO_AUTH_URL there fails
 * closed instead of letting everyone in.
 */
export function usesDevUser(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.FLOO_AUTH_URL;
}

/**
 * The session for these request cookies, or null when signed out. `setCookies`
 * holds any refreshed session cookie, which the proxy passes back to the browser
 * so people who keep using Cursus stay signed in.
 */
export async function fetchSession(cookie: string): Promise<{ session: FlooSession | null; setCookies: string[] }> {
  const base = process.env.FLOO_AUTH_URL;
  if (!base) throw new Error("Sign-in is not configured: FLOO_AUTH_URL is missing.");
  if (!cookie) return { session: null, setCookies: [] };

  const response = await fetch(`${base}/get-session`, { headers: { cookie }, cache: "no-store" });
  const session = response.ok ? ((await response.json()) as FlooSession | null) : null;
  return { session: session?.user ? session : null, setCookies: response.headers.getSetCookie() };
}
