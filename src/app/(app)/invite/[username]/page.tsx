import { redirect } from "next/navigation";

// Invite links land on the inviter's profile (after sign-in) to add them.
export default async function InvitePage({ params }: { params: Promise<{ username: string }> }) {
  redirect(`/u/${encodeURIComponent((await params).username)}`);
}
