"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/access";
import { getCurrentUser, requireProfile } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  acceptFriend,
  removeFriendship,
  requestFriend,
  rerankRating,
  setWanted,
  submitRating,
  updateRatingNotes,
  type NoteFields,
  type RatingInput,
} from "@/lib/queries";
import { BUCKETS, VISIBILITY_LABELS, type Visibility } from "@/lib/rating";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Onboarding (sign-in itself is in src/app/auth)
// ---------------------------------------------------------------------------

export async function completeProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  if (!user.allowed) redirect("/duke-only");

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

// Server actions take client input, so re-validate every field.
function cleanNotes(input: NoteFields & { visibility: Visibility }) {
  if (!(input.visibility in VISIBILITY_LABELS)) return null;
  const workload =
    Number.isInteger(input.workload) && input.workload! >= 1 && input.workload! <= 5
      ? input.workload
      : null;
  return {
    visibility: input.visibility,
    professor: clean(input.professor, 80),
    semester: clean(input.semester, 20),
    workload,
    attendance: typeof input.attendance === "boolean" ? input.attendance : null,
    grading: clean(input.grading, 200),
    note: clean(input.note, 2000),
  };
}

function cleanRating(input: RatingInput): RatingInput | null {
  const notes = cleanNotes(input);
  if (!notes || !(input.bucket in BUCKETS)) return null;
  return { ...notes, courseId: Number(input.courseId), bucket: input.bucket, rank: Number(input.rank) };
}

export async function rateCourse(
  input: RatingInput,
): Promise<Result<{ score: number; total: number }>> {
  const me = await requireProfile();
  const rating = cleanRating(input);
  if (!rating) return { ok: false, error: "Invalid rating." };
  try {
    const { score, total } = await submitRating(me.id, rating);
    revalidatePath("/", "layout");
    return { ok: true, score, total };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function rerankCourse(
  input: RatingInput,
): Promise<Result<{ score: number; total: number }>> {
  const me = await requireProfile();
  const rating = cleanRating(input);
  if (!rating) return { ok: false, error: "Invalid rating." };
  try {
    const { score, total } = await rerankRating(me.id, rating);
    revalidatePath("/", "layout");
    return { ok: true, score, total };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function editRatingNotes(
  courseId: number,
  input: NoteFields & { visibility: Visibility },
): Promise<Result> {
  const me = await requireProfile();
  const notes = cleanNotes(input);
  if (!notes) return { ok: false, error: "Invalid notes." };
  try {
    await updateRatingNotes(me.id, Number(courseId), notes);
    revalidatePath("/", "layout");
    return { ok: true };
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
