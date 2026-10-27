import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "./db";

export const SESSION_COOKIE = "cursus_session";
const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

export type User = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
};
export type Profile = User & { username: string; full_name: string };

export function normalizeDukeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[a-z0-9._%+-]+@duke\.edu$/.test(email) ? email : null;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return "dev-only-secret";
}

// Codes are 6 digits, so hash with a server secret (not plain sha256) to keep
// a leaked table from being brute-forced offline.
const hashCode = (email: string, code: string) =>
  createHmac("sha256", secret()).update(`${email}:${code}`).digest("hex");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a login code for the email. Returns null if one was sent too recently. */
export async function issueLoginCode(email: string): Promise<string | null> {
  const recent = await queryOne(
    `select 1 from login_codes where email = $1
       and created_at > now() - make_interval(secs => $2)`,
    [email, RESEND_COOLDOWN_SECONDS],
  );
  if (recent) return null;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await query(
    `insert into login_codes (email, code_hash, expires_at)
     values ($1, $2, now() + make_interval(mins => $3))
     on conflict (email) do update
       set code_hash = excluded.code_hash, expires_at = excluded.expires_at,
           attempts = 0, created_at = now()`,
    [email, hashCode(email, code), CODE_MINUTES],
  );
  return code;
}

/** Checks a code; on success consumes it and returns the (possibly new) user. */
export async function redeemLoginCode(email: string, code: string): Promise<User | null> {
  const row = await queryOne<{ code_hash: string; expired: boolean; attempts: number }>(
    `update login_codes set attempts = attempts + 1 where email = $1
     returning code_hash, expires_at < now() as expired, attempts`,
    [email],
  );
  if (!row || row.expired || row.attempts > MAX_CODE_ATTEMPTS) return null;

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(email, code.trim()), "hex");
  if (!timingSafeEqual(expected, actual)) return null;

  await query("delete from login_codes where email = $1", [email]);
  return queryOne<User>(
    `insert into users (email) values ($1)
     on conflict (email) do update set email = excluded.email
     returning id, email, username, full_name`,
    [email],
  );
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return queryOne<User>(
    `select u.id, u.email, u.username, u.full_name
     from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
});

/** For pages behind sign-in: redirects to /login or /onboarding as needed. */
export async function requireProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.username || !user.full_name) redirect("/onboarding");
  return user as Profile;
}
