"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rateCourse } from "@/app/actions";
import { ScoreBadge } from "@/components/ui";
import {
  answer,
  BUCKETS,
  isSettled,
  maxComparisons,
  pivotOf,
  startSearch,
  tie,
  UNLOCK_AT,
  VISIBILITY_LABELS,
  type Bucket,
  type Search,
  type Visibility,
} from "@/lib/rating";

type Course = { id: number; code: string; title: string };
type Ranked = { course_id: number; course_code: string; course_title: string; rank: number };

const BUCKET_STYLE: Record<Bucket, string> = {
  liked: "border-liked text-liked",
  fine: "border-fine text-fine",
  disliked: "border-disliked text-disliked",
};

// Fall 2026 back through Fall 2021, newest first.
function recentSemesters(): string[] {
  const now = new Date();
  let year = now.getFullYear();
  let term = now.getMonth() >= 7 ? 2 : now.getMonth() >= 4 ? 1 : 0; // Spring, Summer, Fall
  const names = ["Spring", "Summer", "Fall"];
  const out: string[] = [];
  while (out.length < 15) {
    out.push(`${names[term]} ${year}`);
    if (--term < 0) {
      term = 2;
      year--;
    }
  }
  return out;
}

export function RateFlow({
  course,
  alreadyRated,
  ratedCount,
  buckets,
}: {
  course: Course;
  alreadyRated: boolean;
  ratedCount: number;
  buckets: Record<Bucket, Ranked[]>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"bucket" | "details" | "compare" | "done">("bucket");
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [search, setSearch] = useState<Search>({ lo: 0, hi: 0 });
  const [asked, setAsked] = useState(0);
  const [details, setDetails] = useState({
    professor: "",
    semester: "",
    workload: null as number | null,
    attendance: null as boolean | null,
    grading: "",
    note: "",
    visibility: "public" as Visibility,
  });
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const others = bucket ? buckets[bucket] : [];

  if (alreadyRated && !result) {
    return (
      <div className="px-4 pt-16 text-center">
        <h1 className="text-xl font-bold">You already rated {course.code}</h1>
        <p className="mt-1 text-sm text-muted">Re-ranking a course is coming later.</p>
        <Link
          href={`/course/${course.id}`}
          className="mt-6 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-white"
        >
          View course
        </Link>
      </div>
    );
  }

  const save = (rank: number) => {
    if (!bucket) return;
    setError(null);
    startTransition(async () => {
      const res = await rateCourse({ courseId: course.id, bucket, rank, ...details });
      if (!res.ok) return setError(res.error);
      setResult({ score: res.score, total: res.total });
      setStep("done");
    });
  };

  const afterDetails = () => {
    if (!bucket) return;
    if (others.length === 0) return save(0);
    setSearch(startSearch(others.length));
    setAsked(0);
    setStep("compare");
  };

  const pick = (next: Search) => {
    setAsked((a) => a + 1);
    if (isSettled(next)) return save(next.lo);
    setSearch(next);
  };

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col px-4 pt-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() =>
            step === "bucket" || step === "done"
              ? router.back()
              : setStep(step === "compare" ? "details" : "bucket")
          }
          className="text-sm text-muted"
          disabled={pending}
        >
          ← {step === "bucket" || step === "done" ? "Back" : "Previous"}
        </button>
        <span className="text-xs text-muted">{course.code}</span>
      </div>

      {step === "bucket" && (
        <section className="mt-6">
          <p className="text-sm font-semibold text-accent">{course.code}</p>
          <h1 className="text-2xl leading-tight font-bold">{course.title}</h1>
          <p className="mt-6 mb-3 font-medium">How was it?</p>
          <div className="space-y-3">
            {(Object.keys(BUCKETS) as Bucket[]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBucket(b);
                  setStep("details");
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-surface px-4 py-4 text-left text-lg font-semibold ${BUCKET_STYLE[b]}`}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ background: `var(--${b})` }}
                  aria-hidden
                />
                {BUCKETS[b].label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "details" && (
        <section className="mt-6 space-y-5">
          <div>
            <h1 className="text-xl font-bold">Add notes</h1>
            <p className="text-sm text-muted">All optional — helps other students decide.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Professor</span>
              <input
                value={details.professor}
                maxLength={80}
                onChange={(e) => setDetails({ ...details, professor: e.target.value })}
                placeholder="Last name"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Semester</span>
              <select
                value={details.semester}
                onChange={(e) => setDetails({ ...details, semester: e.target.value })}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
              >
                <option value="">—</option>
                {recentSemesters().map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Workload</legend>
            <Segmented
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
              value={details.workload}
              onChange={(workload) => setDetails({ ...details, workload })}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>Light</span>
              <span>Heavy</span>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Attendance required?</legend>
            <Segmented
              options={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              value={details.attendance}
              onChange={(attendance) => setDetails({ ...details, attendance })}
            />
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Grading</span>
            <input
              value={details.grading}
              maxLength={200}
              onChange={(e) => setDetails({ ...details, grading: e.target.value })}
              placeholder="e.g. curved, exam-heavy, generous partial credit"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Notes</span>
            <textarea
              value={details.note}
              maxLength={2000}
              rows={4}
              onChange={(e) => setDetails({ ...details, note: e.target.value })}
              placeholder="What should someone know before taking this?"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Who can see your notes?</legend>
            <Segmented
              options={(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => ({
                value: v,
                label: VISIBILITY_LABELS[v],
              }))}
              value={details.visibility}
              onChange={(v) => setDetails({ ...details, visibility: v ?? details.visibility })}
              small
            />
            <p className="mt-1 text-xs text-muted">
              Friends always see your score. Public notes never show your name to non-friends.
            </p>
          </fieldset>

          <button
            onClick={afterDetails}
            disabled={pending}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : others.length ? "Next: compare" : "Save rating"}
          </button>
        </section>
      )}

      {step === "compare" && bucket && (
        <section className="mt-6 flex flex-1 flex-col">
          <p className="text-xs text-muted">
            Comparison {Math.min(asked + 1, maxComparisons(others.length))} of up to{" "}
            {maxComparisons(others.length)}
          </p>
          <h1 className="mt-1 text-xl font-bold">Which did you like more?</h1>
          <div className="mt-5 grid flex-1 grid-rows-2 gap-3 sm:max-h-96">
            <CompareCard
              code={course.code}
              title={course.title}
              tag="New"
              disabled={pending}
              onClick={() => pick(answer(search, true))}
            />
            <CompareCard
              code={others[pivotOf(search)].course_code}
              title={others[pivotOf(search)].course_title}
              disabled={pending}
              onClick={() => pick(answer(search, false))}
            />
          </div>
          <button
            onClick={() => pick(tie(search))}
            disabled={pending}
            className="mt-3 py-3 text-sm font-medium text-muted"
          >
            Too close to call
          </button>
        </section>
      )}

      {step === "done" && result && (
        <section className="mt-10 flex flex-col items-center text-center">
          <ScoreBadge
            score={result.total >= UNLOCK_AT ? result.score : null}
            bucket={bucket!}
            size="lg"
          />
          <h1 className="mt-4 text-2xl font-bold">Rated {course.code}</h1>
          <p className="mt-1 text-muted">
            {result.total >= UNLOCK_AT
              ? `It scores ${result.score.toFixed(1)} among your ${result.total} courses.`
              : `Rate ${UNLOCK_AT - result.total} more to unlock your scores.`}
          </p>
          <div className="mt-8 grid w-full gap-2">
            <Link
              href="/rate"
              className="rounded-xl bg-accent py-3 text-center font-semibold text-white"
            >
              Rate another
            </Link>
            <Link
              href={`/course/${course.id}`}
              className="rounded-xl border border-line bg-surface py-3 text-center font-semibold"
            >
              View course
            </Link>
          </div>
        </section>
      )}

      {pending && step === "compare" && (
        <p className="mt-3 text-center text-sm text-muted">Saving…</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-disliked">
          {error}
        </p>
      )}
      {ratedCount < UNLOCK_AT && step !== "done" && (
        <p className="mt-auto pt-6 pb-2 text-center text-xs text-muted">
          {ratedCount}/{UNLOCK_AT} rated — scores unlock at {UNLOCK_AT}
        </p>
      )}
    </div>
  );
}

function CompareCard({
  code,
  title,
  tag,
  disabled,
  onClick,
}: {
  code: string;
  title: string;
  tag?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col justify-center rounded-2xl border-2 border-line bg-surface p-5 text-left transition active:scale-[0.98] active:border-accent disabled:opacity-60"
    >
      {tag && (
        <span className="mb-2 w-fit rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          {tag}
        </span>
      )}
      <span className="text-lg font-bold">{code}</span>
      <span className="text-sm text-muted">{title}</span>
    </button>
  );
}

function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
  small,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  small?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            // tap again to clear an optional answer
            onClick={() => onChange(on ? null : o.value)}
            className={`flex-1 rounded-xl border px-2 ${small ? "py-2 text-xs" : "py-2.5 text-sm"} font-medium ${
              on ? "border-accent bg-accent text-white" : "border-line bg-surface"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
