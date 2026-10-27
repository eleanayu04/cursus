import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Floo has no email service, so login codes go out over SMTP from any
// provider (Gmail app password, Resend, SendGrid, ...), configured with
// SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM.
// Without SMTP (local dev, or a demo with LOG_LOGIN_CODES=1) the code is
// printed to the server log instead.

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    const port = Number(SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // 587 upgrades with STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const mailer = smtp();
  if (!mailer) {
    if (process.env.NODE_ENV === "production" && process.env.LOG_LOGIN_CODES !== "1") {
      throw new Error("Email is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)");
    }
    console.log(`[cursus] login code for ${email}: ${code}`);
    return;
  }

  await mailer.sendMail({
    from: process.env.EMAIL_FROM ?? `Cursus <${process.env.SMTP_USER}>`,
    to: email,
    subject: `${code} is your Cursus code`,
    text: `Your Cursus sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px">
      <p>Your Cursus sign-in code is</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:8px 0">${code}</p>
      <p style="color:#6b6f78;font-size:14px">It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.</p>
    </div>`,
  });
  console.log(`[cursus] sent login code to ${email}`);
}
