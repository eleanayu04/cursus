// Floo's gateway owns the session; signing out is a POST to its logout route.
export function SignOutButton() {
  return (
    <form action="/__floo/logout" method="post">
      <button className="w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-muted">
        Sign out
      </button>
    </form>
  );
}
