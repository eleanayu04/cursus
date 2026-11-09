import { createNeonAuth } from "@neon/auth/next/server";

// Floo User accounts: Floo runs the sign-in service (Better Auth, managed by
// Neon) and publishes FLOO_AUTH_URL. Users live in the neon_auth schema of our
// own Postgres. The SDK validates its config when created, and these env vars
// only exist at runtime, so it has to be created lazily or `next build` fails.

type NeonAuth = ReturnType<typeof createNeonAuth>;

let instance: NeonAuth | undefined;

export function getAuth(): NeonAuth {
  if (instance) return instance;
  const baseUrl = process.env.FLOO_AUTH_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("Sign-in is not configured: FLOO_AUTH_URL and NEON_AUTH_COOKIE_SECRET are required.");
  }
  instance = createNeonAuth({ baseUrl, cookies: { secret } });
  return instance;
}

/**
 * Local development has no sign-in service, so requests act as DEV_USER_EMAIL.
 * Never true in a production build, so a missing FLOO_AUTH_URL there fails
 * closed instead of letting everyone in.
 */
export function usesDevUser(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.FLOO_AUTH_URL;
}
