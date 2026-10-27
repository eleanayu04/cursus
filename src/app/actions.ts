"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  endSession,
  getCurrentUser,
  issueLoginCode,
  normalizeDukeEmail,
  redeemLoginCode,
  requireProfile,
  startSession,
} from "@/lib/auth";
import { query } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";
import {
  acceptFriend,
  removeFriendship,
  requestFriend,
  setWanted,
  submitRating,
  type RatingInput,
} from "@/lib/queries";
import { BUCKETS, VISIBILITY_LABELS } from "@/lib/rating";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Only same-site paths, so ?next= can't bounce people to another domain.
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

export async function requestCode(rawEmail: string): Promise<Result<{ email: string }>> {
  const email = normalizeDukeEmail(rawEmail);
  if (!email) return { ok: false, error: "Use your @duke.edu email address." };

  const code = await issueLoginCode(email);
  if (!code) return { ok: true, email }; // already sent one moments ago
  try {
    await sendLoginCode(email, code);
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't send the code. Try again in a minute." };
  }
  return { ok: true, email };
}

export async function verifyCode(
  rawEmail: string,
  code: string,
  next: string,
): Promise<Result<{ redirectTo: string }>> {
  const email = normalizeDukeEmail(rawEmail);
  if (!email || !/^\d{6}$/.test(code.trim())) {
    return { ok: false, error: "Enter the 6-digit code from your email." };
  }
  const user = await redeemLoginCode(email, code);
  if (!user) return { ok: false, error: "That code is wrong or expired." };

  await startSession(user.id);
  const dest = safeNext(next);
  return {
    ok: true,
    redirectTo: user.username ? dest : `/onboarding?next=${encodeURIComponent(dest)}`,
  };
}

export async function signOut() {
  await endSession();
  redirect("/login");
}

export async function completeProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const username = String(formData.get("username") ?? "").trim().toLowerCase().replace(/^@/, "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const back = (error: string) =>
    redirect(`/onboarding?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`);

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    back("Usernames are 3–20 lowercase letters, numbers, or underscores.");
  }
  if (fullName.length < 1 || fullName.length > 60) back("Enter your name.");

  try {
    await query("update users set username = $2, full_name = $3 where id = $1", [
      user.id,
      username,
      fullName,
    ]);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") back("That username is taken.");
    throw err;
  }
  redirect(next);
}

// ---------------------------------------------------------------------------
// Rating
// ---------------------------------------------------------------------------

const clean = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function rateCourse(
  input: RatingInput,
): Promise<Result<{ score: number; total: number }>> {
  const me = await requireProfile();
  if (!(input.bucket in BUCKETS) || !(input.visibility in VISIBILITY_LABELS)) {
    return { ok: false, error: "Invalid rating." };
  }
  const workload =
    Number.isInteger(input.workload) && input.workload! >= 1 && input.workload! <= 5
      ? input.workload
      : null;

  try {
    const { score, total } = await submitRating(me.id, {
      courseId: Number(input.courseId),
      bucket: input.bucket,
      rank: Number(input.rank),
      visibility: input.visibility,
      professor: clean(input.professor, 80),
      semester: clean(input.semester, 20),
      workload,
      attendance: typeof input.attendance === "boolean" ? input.attendance : null,
      grading: clean(input.grading, 200),
      note: clean(input.note, 2000),
    });
    revalidatePath("/", "layout");
    return { ok: true, score, total };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Friends & want-to-take
// ---------------------------------------------------------------------------

export async function addFriend(otherId: string) {
  const me = await requireProfile();
  await requestFriend(me.id, otherId);
  revalidatePath("/", "layout");
}

export async function acceptFriendRequest(requesterId: string) {
  const me = await requireProfile();
  await acceptFriend(me.id, requesterId);
  revalidatePath("/", "layout");
}

export async function removeFriend(otherId: string) {
  const me = await requireProfile();
  await removeFriendship(me.id, otherId);
  revalidatePath("/", "layout");
}

export async function toggleWant(courseId: number, wanted: boolean) {
  const me = await requireProfile();
  await setWanted(me.id, courseId, wanted);
  revalidatePath("/", "layout");
}
