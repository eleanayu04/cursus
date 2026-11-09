"use server";

import { redirect } from "next/navigation";
import { canUseCursus, safeNext } from "@/lib/access";
import { getAuth, usesDevUser } from "@/lib/neon-auth";

export type AuthResult = { ok: boolean; error?: string; needsVerification?: boolean };

const cleanEmail = (email: string) => email.trim().toLowerCase();

// The SDK's server type leaves emailOtp as unknown, though it proxies these calls.
type OtpResult<T = unknown> = Promise<{ data: T | null; error: { message?: string } | null }>;
type EmailOtp = {
  sendVerificationOtp(args: { email: string; type: "email-verification" | "forget-password" }): OtpResult;
  verifyEmail(args: { email: string; otp: string }): OtpResult<{ token?: string | null }>;
  resetPassword(args: { email: string; otp: string; password: string }): OtpResult;
};
const emailOtp = () => getAuth().emailOtp as unknown as EmailOtp;

const sendCode = (email: string, type: "email-verification" | "forget-password") =>
  emailOtp().sendVerificationOtp({ email, type });

export async function signIn(input: { email: string; password: string; next?: string }): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const { data, error } = await getAuth().signIn.email({ email, password: input.password });
  // The SDK renames Better Auth's EMAIL_NOT_VERIFIED to this code.
  if (error?.code === "email_not_confirmed" || (data?.user && !data.user.emailVerified)) {
    await sendCode(email, "email-verification");
    return { ok: false, needsVerification: true };
  }
  if (error) return { ok: false, error: error.message || "Couldn't sign you in. Try again." };
  redirect(safeNext(input.next));
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const name = input.name.trim().slice(0, 60);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!canUseCursus(email)) return { ok: false, error: "Cursus is for Duke students. Use your @duke.edu email." };

  const { data, error } = await getAuth().signUp.email({ email, name, password: input.password });
  if (error) return { ok: false, error: error.message || "Couldn't create your account. Try again." };
  // The sign-in service emails the code itself on sign-up.
  if (data?.user && !data.user.emailVerified) return { ok: false, needsVerification: true };
  redirect(safeNext(input.next));
}

/** Confirms the emailed code, then signs in unless the service already did. */
export async function verifyEmail(input: {
  email: string;
  code: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const { data, error } = await emailOtp().verifyEmail({ email, otp: input.code.trim() });
  if (error) return { ok: false, error: "That code didn't work. Check it, or send a new one." };
  if (!data?.token) {
    const signedIn = await getAuth().signIn.email({ email, password: input.password });
    if (signedIn.error) return { ok: false, error: "Email verified. Go back and sign in." };
  }
  redirect(safeNext(input.next));
}

export async function resendCode(input: { email: string }): Promise<AuthResult> {
  const { error } = await sendCode(cleanEmail(input.email), "email-verification");
  return error ? { ok: false, error: error.message || "Couldn't send a new code." } : { ok: true };
}

export async function requestPasswordReset(input: { email: string }): Promise<AuthResult> {
  const { error } = await sendCode(cleanEmail(input.email), "forget-password");
  return error ? { ok: false, error: error.message || "Couldn't send a reset code." } : { ok: true };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
  next?: string;
}): Promise<AuthResult> {
  const email = cleanEmail(input.email);
  const { error } = await emailOtp().resetPassword({
    email,
    otp: input.code.trim(),
    password: input.password,
  });
  if (error) return { ok: false, error: "That code didn't work. Check it, or send a new one." };
  return signIn({ email, password: input.password, next: input.next });
}

export async function signOut() {
  if (usesDevUser()) redirect("/");
  await getAuth().signOut();
  redirect("/auth/sign-in");
}
