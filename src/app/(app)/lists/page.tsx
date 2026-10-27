import Link from "next/link";
import { toggleWant } from "@/app/actions";
import { Card, CourseRow, Empty, PageHeader, ScoreBadge, UnlockBanner } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { myRatings, wantList } from "@/lib/queries";
import { UNLOCK_AT } from "@/lib/rating";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireProfile();
  const tab = (await searchParams).tab === "want" ? "want" : "rated";
  const [ratings, wants] = await Promise.all([myRatings(me.id), wantList(me.id)]);
  const unlocked = ratings.length >= UNLOCK_AT;

  return (
    <>
      <PageHeader title="My lists" />
      <div className="mx-4 mb-3 flex rounded-xl bg-line/60 p-1 text-sm font-medium">
        {[
          { key: "rated", label: `Rated · ${ratings.length}` },
          { key: "want", label: `Want to take · ${wants.length}` },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "rated" ? "/lists" : "/lists?tab=want"}
            className={`flex-1 rounded-lg py-2 text-center ${
              tab === t.key ? "bg-surface shadow-sm" : "text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "rated" ? (
        <>
          <UnlockBanner count={ratings.length} />
          {ratings.length ? (
            <Card className="mx-4 divide-y divide-line overflow-hidden">
              {ratings.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/course/${r.course_id}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="w-5 text-right text-sm text-muted tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{r.course_code}</div>
                    <div className="truncate text-sm text-muted">{r.course_title}</div>
                  </div>
                  <ScoreBadge score={unlocked ? r.score : null} bucket={r.bucket} size="sm" />
                </Link>
              ))}
            </Card>
          ) : (
            <Empty>
              You haven&apos;t rated anything yet.{" "}
              <Link href="/rate" className="font-semibold text-accent">
                Rate your first course
              </Link>
            </Empty>
          )}
        </>
      ) : wants.length ? (
        <Card className="mx-4 divide-y divide-line overflow-hidden">
          {wants.map((c) => (
            <div key={c.id} className="flex items-center">
              <div className="min-w-0 flex-1">
                <CourseRow course={c} href={`/course/${c.id}`} />
              </div>
              <form action={toggleWant.bind(null, c.id, false)}>
                <button className="px-4 py-3 text-xs text-muted" aria-label={`Remove ${c.code}`}>
                  Remove
                </button>
              </form>
            </div>
          ))}
        </Card>
      ) : (
        <Empty>
          Bookmark courses you&apos;re considering from any course page with “Want to take”.
        </Empty>
      )}
    </>
  );
}
