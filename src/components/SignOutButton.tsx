"use client";

import { useState } from "react";
import { auth } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const signOut = async () => {
    setPending(true);
    // Locally there's no sign-in service, so this fails and the sign-in page
    // sends the dev user home again.
    await auth.signOut().catch(() => null);
    // A full page load, so no signed-in pages stay in the client router's cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/auth/sign-in");
  };
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-muted disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
