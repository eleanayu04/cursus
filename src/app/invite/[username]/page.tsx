import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Invite links land on the inviter's profile so the person can add them. This
// sits outside the (app) group because that layout sends anyone without a
// profile to onboarding first, which would lose the destination.
export default async function InvitePage({ params }: { params: Promise<{ username: string }> }) {
  const profile = `/u/${encodeURIComponent((await params).username)}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(profile)}`);
  if (!user.username || !user.full_name) redirect(`/onboarding?next=${encodeURIComponent(profile)}`);
  redirect(profile);
}
