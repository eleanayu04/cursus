import { signOut } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-muted">
        Sign out
      </button>
    </form>
  );
}
