import Link from "next/link";
import type { CourseWithStats } from "@/lib/queries";
import { bucketForScore, type Bucket } from "@/lib/rating";

const BUCKET_COLOR: Record<Bucket, string> = {
  liked: "var(--liked)",
  fine: "var(--fine)",
  disliked: "var(--disliked)",
};

/** Beli-style colored score circle. Without a score it shows the bucket color only. */
export function ScoreBadge({
  score,
  bucket,
  size = "md",
}: {
  score: number | null;
  bucket?: Bucket;
  size?: "sm" | "md" | "lg";
}) {
  const b = bucket ?? (score != null ? bucketForScore(score) : null);
  const color = b ? BUCKET_COLOR[b] : "var(--line)";
  const dims = { sm: "h-9 w-9 text-sm", md: "h-11 w-11 text-base", lg: "h-20 w-20 text-3xl" }[
    size
  ];
  return (
    <div
      className={`${dims} flex shrink-0 items-center justify-center rounded-full border-2 bg-surface font-semibold tabular-nums`}
      style={{ borderColor: color, color: score != null ? color : "var(--muted)" }}
      aria-label={score != null ? `Score ${score.toFixed(1)}` : "No score yet"}
    >
      {score != null ? score.toFixed(1) : "–"}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pt-6 pb-3">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>
  );
}

export function CourseRow({ course, href }: { course: CourseWithStats; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-bg">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{course.code}</div>
        <div className="truncate text-sm text-muted">{course.title}</div>
      </div>
      <div className="flex flex-col items-center">
        <ScoreBadge score={course.avg_score} size="sm" />
        <span className="mt-0.5 text-[10px] text-muted">
          {course.rating_count ? `${course.rating_count} rated` : "new"}
        </span>
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>;
}

export function UnlockBanner({ count }: { count: number }) {
  const left = 4 - count;
  if (left <= 0) return null;
  return (
    <div className="mx-4 mb-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
      <span className="font-semibold">
        Rate {left} more course{left === 1 ? "" : "s"}
      </span>{" "}
      to unlock your scores. Until then your ratings are saved but don&apos;t count toward
      campus averages.
    </div>
  );
}

export function timeAgo(date: Date | string): string {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NoteDetails({
  n,
}: {
  n: {
    professor: string | null;
    semester: string | null;
    workload: number | null;
    attendance: boolean | null;
    grading: string | null;
    note: string | null;
  };
}) {
  const tags = [
    n.professor && `Prof. ${n.professor}`,
    n.semester,
    n.workload && `Workload ${n.workload}/5`,
    n.attendance != null && (n.attendance ? "Attendance required" : "No attendance"),
    n.grading && `Grading: ${n.grading}`,
  ].filter(Boolean) as string[];
  return (
    <>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
      {n.note && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{n.note}</p>}
    </>
  );
}
