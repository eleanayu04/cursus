import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { completeProfile } from "../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { error, next } = await searchParams;
  const suggested = user.email.split("@")[0].replace(/[^a-z0-9_]/g, "").slice(0, 20);

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to Cursus</h1>
      <p className="mt-1 mb-8 text-muted">
        Friends find you by username. Your name is only shown to friends — notes you share
        publicly stay anonymous.
      </p>
      <form action={completeProfile} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />
        <div>
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="full_name"
            name="full_name"
            required
            maxLength={60}
            defaultValue={user.full_name ?? ""}
            placeholder="First Last"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium">
            Username
          </label>
          <div className="flex items-center rounded-xl border border-line bg-surface px-4 focus-within:border-accent">
            <span className="text-muted">@</span>
            <input
              id="username"
              name="username"
              required
              pattern="[a-z0-9_]{3,20}"
              maxLength={20}
              defaultValue={user.username ?? suggested}
              autoCapitalize="none"
              className="w-full bg-transparent py-3 pl-1 outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted">3–20 lowercase letters, numbers, or underscores.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-disliked">
            {error}
          </p>
        )}
        <button className="w-full rounded-xl bg-accent py-3 font-semibold text-white">
          Continue
        </button>
      </form>
    </div>
  );
}
