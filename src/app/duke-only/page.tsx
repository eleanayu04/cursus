import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function DukeOnlyPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <h1 className="text-2xl font-bold tracking-tight">Cursus is for Duke students</h1>
      <p className="mt-2 text-muted">
        You&apos;re signed in as <span className="font-semibold text-ink">{user?.email}</span>.
        Sign out and sign back in with your @duke.edu account.
      </p>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
