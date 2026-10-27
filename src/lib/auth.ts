import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "./db";

// Sign-in is Floo accounts mode: Floo's gateway authenticates every request
// and passes the user's identity in X-Floo-User-* headers. Cursus keeps its
// own users row (username, name) keyed by that email.
//
// Locally there's no gateway, so in development a request without headers
// acts as DEV_USER_EMAIL (default dev@duke.edu). Send X-Floo-User-Email
// yourself, or use `floo dev --fixture-user`, to act as someone else.

export type User = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
};
export type Profile = User & { username: string; full_name: string };

type FlooIdentity = { email: string; name: string | null; role: string | null };

async function flooIdentity(): Promise<FlooIdentity | null> {
  const h = await headers();
  const email = h.get("x-floo-user-email")?.trim().toLowerCase();
  if (email) {
    return { email, name: h.get("x-floo-user-name"), role: h.get("x-floo-user-role") };
  }
  if (process.env.NODE_ENV !== "production") {
    return { email: (process.env.DEV_USER_EMAIL ?? "dev@duke.edu").toLowerCase(), name: null, role: "admin" };
  }
  return null;
}

/** The signed-in Floo user, as a Cursus users row (created on first visit). */
export const getCurrentUser = cache(async (): Promise<(User & { isDuke: boolean; isAdmin: boolean; flooName: string | null }) | null> => {
  const id = await flooIdentity();
  if (!id) return null;
  const user =
    (await queryOne<User>(
      "select id, email, username, full_name from users where email = $1",
      [id.email],
    )) ??
    (await queryOne<User>(
      `insert into users (email) values ($1)
       on conflict (email) do update set email = excluded.email
       returning id, email, username, full_name`,
      [id.email],
    ));
  if (!user) return null;
  // Floo uses the email as the name when none is set.
  const flooName = id.name && id.name.toLowerCase() !== id.email ? id.name : null;
  return {
    ...user,
    isDuke: id.email.endsWith("@duke.edu"),
    isAdmin: id.role === "admin",
    flooName,
  };
});

/**
 * For pages behind sign-in. Cursus is for Duke students, so anyone Floo lets
 * in without a @duke.edu email is turned away, except app admins (you, the
 * owner, testing with a non-Duke Floo account).
 */
export async function requireProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No Floo identity on this request. Is access_mode = \"accounts\"?");
  if (!user.isDuke && !user.isAdmin) redirect("/duke-only");
  if (!user.username || !user.full_name) redirect("/onboarding");
  return user as Profile;
}
