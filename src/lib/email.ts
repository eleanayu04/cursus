import "server-only";

// Floo has no email service, so codes go out through Resend when
// RESEND_API_KEY is set. Without it (local dev, or a demo with
// LOG_LOGIN_CODES=1) the code is printed to the server log instead.
export async function sendLoginCode(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production" && process.env.LOG_LOGIN_CODES !== "1") {
      throw new Error("Email is not configured (set RESEND_API_KEY)");
    }
    console.log(`[cursus] login code for ${email}: ${code}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Cursus <onboarding@resend.dev>",
      to: email,
      subject: `${code} is your Cursus code`,
      text: `Your Cursus sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  }
}
