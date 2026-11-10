import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { canUseCursus } from "./access";
import { queryOne } from "./db";
import { fetchSession, usesDevUser } from "./session";

// Sign-in is Floo User accounts (see session.ts). Cursus keeps its own users
// row (username, name) keyed by the verified email, so anyone who signs in with
// an email Cursus already knows gets their existing ratings and friends.
//
// Locally there's no sign-in service, so requests act as DEV_USER_EMAIL
// (default dev@duke.edu).

export type User = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
};
export type Profile = User & { username: string; full_name: string };

type Identity = { email: string; name: string | null };

async function currentIdentity(): Promise<Identity | null> {
  if (usesDevUser()) {
    return { email: (process.env.DEV_USER_EMAIL ?? "dev@duke.edu").toLowerCase(), name: null };
  }
  const { session } = await fetchSession((await headers()).get("cookie") ?? "");
  const user = session?.user;
  // Email is the key to someone's data and to the Duke check, so it has to be
  // one they've proven they own.
  if (!user?.email || !user.emailVerified) return null;
  return { email: user.email.trim().toLowerCase(), name: user.name || null };
}

/** The signed-in user, as a Cursus users row (created on first visit). */
export const getCurrentUser = cache(async (): Promise<(User & { allowed: boolean; authName: string | null }) | null> => {
  const id = await currentIdentity();
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
  return { ...user, allowed: canUseCursus(id.email), authName: id.name };
});

/** For pages and actions behind sign-in. Cursus is for Duke students only. */
export async function requireProfile(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.allowed) redirect("/duke-only");
  if (!user.username || !user.full_name) redirect("/onboarding");
  return user as Profile;
}
