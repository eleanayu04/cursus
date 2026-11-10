import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Floo serves sign-in at /api/auth on Cursus's own domain, so the client needs
// no URL and the session cookie is first-party.
export const auth = createAuthClient({ plugins: [emailOTPClient()] });
