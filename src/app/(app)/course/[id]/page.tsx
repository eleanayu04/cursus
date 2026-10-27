import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleWant } from "@/app/actions";
import { Card, NoteDetails, ScoreBadge, timeAgo } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import {
  courseFriendRatings,
  coursePublicNotes,
  getCourse,
  isWanted,
  myRating,
  myRatingCount,
} from "@/lib/queries";
import { BUCKETS, UNLOCK_AT, VISIBILITY_LABELS } from "@/lib/rating";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireProfile();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [course, mine, count, friends, notes, wanted] = await Promise.all([
    getCourse(id),
    myRating(me.id, id),
    myRatingCount(me.id),
    courseFriendRatings(me.id, id),
    coursePublicNotes(me.id, id),
    isWanted(me.id, id),
  ]);
  if (!course) notFound();
  const unlocked = count >= UNLOCK_AT;

  return (
    <div className="space-y-4 pb-4">
      <header className="px-4 pt-6">
        <Link href="/search" className="text-sm text-muted">
          ← Search
        </Link>
        <p className="mt-3 text-sm font-semibold text-accent">{course.code}</p>
        <h1 className="text-2xl leading-tight font-bold tracking-tight">{course.title}</h1>
      </header>

      <Card className="mx-4 flex items-center gap-4 p-4">
        <ScoreBadge score={course.avg_score} size="lg" />
        <div>
          <div className="font-semibold">Campus average</div>
          <div className="text-sm text-muted">
            {course.rating_count
              ? `${course.rating_count} student${course.rating_count === 1 ? "" : "s"} rated this`
              : "No counted ratings yet"}
          </div>
        </div>
      </Card>

      <div className="px-4">
        {mine ? (
          <Card className="flex items-center gap-3 p-4">
            <ScoreBadge score={unlocked ? mine.score : null} bucket={mine.bucket} />
            <div className="min-w-0">
              <div className="font-semibold">Your rating · {BUCKETS[mine.bucket].label}</div>
              <div className="text-sm text-muted">
                {unlocked
                  ? `Notes visible to: ${VISIBILITY_LABELS[mine.visibility]}`
                  : `Score unlocks after ${UNLOCK_AT} ratings (${count}/${UNLOCK_AT})`}
              </div>
            </div>
          </Card>
        ) : (
          <div className="flex gap-2">
            <Link
              href={`/rate/${course.id}`}
              className="flex-1 rounded-xl bg-accent py-3 text-center font-semibold text-white"
            >
              Rate this course
            </Link>
            <form action={toggleWant.bind(null, course.id, !wanted)}>
              <button
                className={`h-full rounded-xl border px-4 text-sm font-semibold ${
                  wanted ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"
                }`}
              >
                {wanted ? "✓ Want to take" : "+ Want to take"}
              </button>
            </form>
          </div>
        )}
      </div>

      <section>
        <h2 className="px-4 pb-2 text-sm font-semibold tracking-wide text-muted uppercase">
          Friends
        </h2>
        {friends.length ? (
          <div className="space-y-2 px-4">
            {friends.map((f) => (
              <Card key={f.username} className="p-4">
                <div className="flex items-center gap-3">
                  <ScoreBadge score={f.score} bucket={f.bucket} size="sm" />
                  <Link href={`/u/${f.username}`} className="min-w-0 flex-1">
                    <div className="font-semibold">{f.full_name}</div>
                    <div className="text-xs text-muted">
                      @{f.username} · {timeAgo(f.created_at)}
                    </div>
                  </Link>
                </div>
                <NoteDetails n={f} />
              </Card>
            ))}
          </div>
        ) : (
          <p className="px-4 text-sm text-muted">None of your friends have rated this yet.</p>
        )}
      </section>

      <section>
        <h2 className="px-4 pb-2 text-sm font-semibold tracking-wide text-muted uppercase">
          Notes from students
        </h2>
        {notes.length ? (
          <div className="space-y-2 px-4">
            {notes.map((n, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <ScoreBadge score={n.score} bucket={n.bucket} size="sm" />
                  <div className="text-sm text-muted">
                    Anonymous · {timeAgo(n.created_at)}
                  </div>
                </div>
                <NoteDetails n={n} />
              </Card>
            ))}
          </div>
        ) : (
          <p className="px-4 text-sm text-muted">No public notes yet.</p>
        )}
      </section>
    </div>
  );
}
