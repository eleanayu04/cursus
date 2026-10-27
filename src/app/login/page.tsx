"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import { requestCode, verifyCode } from "../actions";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestCode(email);
      if (!res.ok) return setError(res.error);
      setEmail(res.email);
      setStep("code");
    });
  };

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyCode(email, code, next);
      if (!res.ok) return setError(res.error);
      router.replace(res.redirectTo);
      router.refresh();
    });
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6">
      <div className="mb-10">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-white">
          C
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Cursus</h1>
        <p className="mt-1 text-muted">Rank the Duke courses you&apos;ve taken.</p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Duke email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="netid@duke.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          />
          <button
            disabled={pending}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={checkCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">
            Enter the 6-digit code sent to <span className="font-semibold">{email}</span>
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-2xl tracking-[0.4em] tabular-nums outline-none focus:border-accent"
          />
          <button
            disabled={pending || code.length !== 6}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="w-full py-2 text-sm text-muted"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-disliked">
          {error}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
