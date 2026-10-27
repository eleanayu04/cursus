import Link from "next/link";
import { Card, PageHeader, ScoreBadge, timeAgo, UnlockBanner } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { friendFeed, myRatingCount } from "@/lib/queries";

export default async function FeedPage() {
  const me = await requireProfile();
  const [feed, count] = await Promise.all([friendFeed(me.id), myRatingCount(me.id)]);

  return (
    <>
      <PageHeader title="Cursus" subtitle={`Hi, ${me.full_name.split(" ")[0]}`} />
      <UnlockBanner count={count} />
      {feed.length === 0 ? (
        <Card className="mx-4 p-6 text-center">
          <p className="font-semibold">No friend activity yet</p>
          <p className="mt-1 text-sm text-muted">
            Add friends to see what courses they&apos;re ranking.
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white"
          >
            Find friends
          </Link>
        </Card>
      ) : (
        <div className="space-y-2 px-4">
          {feed.map((item) => (
            <Card key={`${item.username}-${item.course_id}`} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link href={`/u/${item.username}`} className="font-semibold">
                      {item.full_name}
                    </Link>{" "}
                    <span className="text-muted">rated</span>{" "}
                    <Link href={`/course/${item.course_id}`} className="font-semibold">
                      {item.course_code}
                    </Link>
                  </p>
                  <p className="truncate text-sm text-muted">{item.course_title}</p>
                  <p className="mt-0.5 text-xs text-muted">{timeAgo(item.created_at)}</p>
                </div>
                <ScoreBadge score={item.score} bucket={item.bucket} />
              </div>
              {item.note && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed">{item.note}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
