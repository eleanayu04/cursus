"use client";

import { createAuthClient } from "@neon/auth/next";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import {
  requestPasswordReset,
  resendCode,
  resetPassword,
  signIn,
  signUp,
  verifyEmail,
  type AuthResult,
} from "./actions";

const authClient = createAuthClient();

type Step = "sign-in" | "sign-up" | "verify" | "forgot" | "reset";

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  "sign-in": { title: "Welcome back", subtitle: "Sign in to rank your Duke courses." },
  "sign-up": { title: "Join Cursus", subtitle: "Rank your Duke courses and see what friends thought." },
  verify: { title: "Check your email", subtitle: "Enter the code we just sent you. It can take a minute." },
  forgot: { title: "Reset your password", subtitle: "We'll email you a code." },
  reset: { title: "Choose a new password", subtitle: "Enter the code we just emailed you." },
};

const INPUT = "w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent";

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
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<AuthResult>, onOk?: () => void) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.needsVerification) setStep("verify");
      else if (result.error) setError(result.error);
      else if (result.ok) onOk?.();
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "sign-in") run(() => signIn({ email, password, next }));
    if (step === "sign-up") run(() => signUp({ name, email, password, next }));
    if (step === "verify") run(() => verifyEmail({ email, code, password, next }));
    if (step === "forgot") {
      run(
        () => requestPasswordReset({ email }),
        () => {
          setPassword("");
          setStep("reset");
        },
      );
    }
    if (step === "reset") run(() => resetPassword({ email, code, password, next }));
  };

  const google = () => {
    setError(null);
    startTransition(async () => {
      // The browser SDK throws on failure, rather than returning an error.
      try {
        await authClient.signIn.social({
          provider: "google",
          callbackURL: `${window.location.origin}${next}`,
        });
      } catch {
        setError("Couldn't start Google sign-in. Try again, or use your email and password.");
      }
    });
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
          onClick={google}
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
          <button
            type="button"
            disabled={pending}
            className="font-semibold text-accent"
            onClick={() => run(() => resendCode({ email }), () => setNotice("New code sent."))}
          >
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
