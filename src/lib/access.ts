/** Same-site paths only, so ?next= can't bounce people to another domain. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/";
}

/**
 * Sign-up is open at the Floo level, so this is Cursus's Duke-only rule: @duke.edu
 * addresses, plus any listed in ADMIN_EMAILS for testing with a non-Duke account.
 */
export function canUseCursus(email: string): boolean {
  const address = email.trim().toLowerCase();
  if (address.endsWith("@duke.edu")) return true;
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .includes(address);
}
