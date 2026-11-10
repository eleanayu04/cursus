"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { auth } from "@/lib/auth-client";

type Step = "sign-in" | "sign-up" | "verify" | "forgot" | "reset";

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  "sign-in": { title: "Welcome back", subtitle: "Sign in to rank your Duke courses." },
  "sign-up": { title: "Join Cursus", subtitle: "Rank your Duke courses and see what friends thought." },
  verify: { title: "Check your email", subtitle: "Enter the code we just sent you. It can take a minute." },
  forgot: { title: "Reset your password", subtitle: "We'll email you a code." },
  reset: { title: "Choose a new password", subtitle: "Enter the code we just emailed you." },
};

const INPUT = "w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent";
const CODE_FAILED = "That code didn't work. Check it, or send a new one.";

// Each step returns an error to show, or nothing when it has moved on.
type Outcome = string | void;
type AuthError = { message?: string } | null;
const say = (error: AuthError, fallback: string) => error?.message || fallback;

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input required className={INPUT} {...props} />
    </label>
  );
}

// Email and password stay in this component across steps, so verifying a code
// can sign straight in and the address never ends up in a URL.
export function AuthFlow({ start, next }: { start: "sign-in" | "sign-up" | "forgot"; next: string }) {
  const [step, setStep] = useState<Step>(start);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const address = () => email.trim().toLowerCase();

  // A full page load, so the server sees the new session cookie.
  const finish = () => {
    window.location.assign(next);
    return new Promise<void>(() => {}); // stay pending while the page changes
  };

  const run = async (step: () => Promise<Outcome>) => {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const problem = await step();
      if (problem) setError(problem);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const sendVerificationCode = () =>
    auth.emailOtp.sendVerificationOtp({ email: address(), type: "email-verification" });

  const signIn = async (): Promise<Outcome> => {
    const { error } = await auth.signIn.email({ email: address(), password });
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      await sendVerificationCode();
      setStep("verify");
      return;
    }
    if (error) return say(error, "Couldn't sign you in. Try again.");
    return finish();
  };

  const signUp = async (): Promise<Outcome> => {
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) return "Enter your name.";
    // Floo refuses other addresses too (allowed_email_domains); this just says so sooner.
    if (!address().endsWith("@duke.edu")) return "Cursus is for Duke students. Use your @duke.edu email.";
    const { data, error } = await auth.signUp.email({ email: address(), password, name: cleanName });
    if (error) return say(error, "Couldn't create your account. Try again.");
    // Floo emails the code itself on sign-up.
    if (!data?.token) {
      setStep("verify");
      return;
    }
    return finish();
  };

  /** Confirms the emailed code, then signs in unless the service already did. */
  const verify = async (): Promise<Outcome> => {
    const { data, error } = await auth.emailOtp.verifyEmail({ email: address(), otp: code.trim() });
    if (error) return CODE_FAILED;
    if (!data?.token) {
      const signedIn = await auth.signIn.email({ email: address(), password });
      if (signedIn.error) return "Email verified. Go back and sign in.";
    }
    return finish();
  };

  const requestReset = async (): Promise<Outcome> => {
    const { error } = await auth.emailOtp.requestPasswordReset({ email: address() });
    if (error) return say(error, "Couldn't send a reset code.");
    setPassword("");
    setStep("reset");
  };

  const reset = async (): Promise<Outcome> => {
    const { error } = await auth.emailOtp.resetPassword({ email: address(), otp: code.trim(), password });
    if (error) return CODE_FAILED;
    return signIn();
  };

  const resend = async (): Promise<Outcome> => {
    const { error } = await sendVerificationCode();
    if (error) return say(error, "Couldn't send a new code.");
    setNotice("New code sent.");
  };

  const google = async (): Promise<Outcome> => {
    // On success the browser leaves for Google.
    const { error } = await auth.signIn.social({ provider: "google", callbackURL: next });
    if (error) return "Couldn't start Google sign-in. Try again, or use your email and password.";
    return new Promise<void>(() => {});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const steps = { "sign-in": signIn, "sign-up": signUp, verify, forgot: requestReset, reset };
    run(steps[step]);
  };

  const query = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  const { title, subtitle } = HEADINGS[step];

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 mb-8 text-muted">{subtitle}</p>

      <form onSubmit={submit} className="space-y-4">
        {step === "sign-up" && (
          <Field
            label="Name"
            autoComplete="name"
            maxLength={60}
            placeholder="First Last"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        {(step === "sign-in" || step === "sign-up" || step === "forgot") && (
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={step === "sign-up" ? "netid@duke.edu" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        {(step === "verify" || step === "reset") && (
          <Field
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        {(step === "sign-in" || step === "sign-up" || step === "reset") && (
          <Field
            label={step === "reset" ? "New password" : "Password"}
            type="password"
            minLength={8}
            autoComplete={step === "sign-in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-disliked">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-muted">{notice}</p>}

        <button disabled={pending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
          {pending
            ? "One moment…"
            : { "sign-in": "Sign in", "sign-up": "Create account", verify: "Verify email", forgot: "Send code", reset: "Set new password" }[step]}
        </button>
      </form>

      {(step === "sign-in" || step === "sign-up") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(google)}
          className="mt-3 w-full rounded-xl border border-line bg-surface py-3 font-semibold disabled:opacity-60"
        >
          Continue with Google
        </button>
      )}

      <div className="mt-6 space-y-2 text-center text-sm text-muted">
        {step === "sign-in" && (
          <>
            <p>
              New here?{" "}
              <Link href={`/auth/sign-up${query}`} className="font-semibold text-accent">
                Create an account
              </Link>
            </p>
            <p>
              <Link href={`/auth/forgot-password${query}`} className="font-semibold text-accent">
                Forgot your password?
              </Link>
            </p>
          </>
        )}
        {step === "sign-up" && (
          <p>
            Already have an account?{" "}
            <Link href={`/auth/sign-in${query}`} className="font-semibold text-accent">
              Sign in
            </Link>
          </p>
        )}
        {step === "verify" && (
          <button type="button" disabled={pending} className="font-semibold text-accent" onClick={() => run(resend)}>
            Send a new code
          </button>
        )}
        {step === "forgot" && (
          <p>
            <Link href={`/auth/sign-in${query}`} className="font-semibold text-accent">
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
