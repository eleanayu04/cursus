import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FriendButton } from "@/components/FriendButton";
import { Card, ScoreBadge } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { friendRatings, friendStatus, getUserByUsername } from "@/lib/queries";

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const me = await requireProfile();
  const user = await getUserByUsername((await params).username);
  if (!user) notFound();
  if (user.id === me.id) redirect("/profile");

  const status = await friendStatus(me.id, user.id);
  const ratings = status === "friends" ? await friendRatings(me.id, user.id) : [];

  return (
    <div className="pb-4">
      <header className="flex items-center gap-4 px-4 pt-8 pb-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent">
          {user.full_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{user.full_name}</h1>
          <p className="text-sm text-muted">@{user.username}</p>
        </div>
      </header>
      <div className="px-4 pb-5">
        <FriendButton userId={user.id} status={status} />
      </div>

      {status === "friends" ? (
        ratings.length ? (
          <Card className="mx-4 divide-y divide-line overflow-hidden">
            {ratings.map((r, i) => (
              <Link
                key={r.course_id}
                href={`/course/${r.course_id}`}
                className="flex items-start gap-3 px-4 py-3"
              >
                <span className="w-5 pt-0.5 text-right text-sm text-muted tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{r.course_code}</div>
                  <div className="truncate text-sm text-muted">{r.course_title}</div>
                  {r.note && <p className="mt-1 line-clamp-2 text-sm">{r.note}</p>}
                </div>
                <ScoreBadge score={r.score} bucket={r.bucket} size="sm" />
              </Link>
            ))}
          </Card>
        ) : (
          <p className="px-4 text-sm text-muted">{user.full_name} hasn&apos;t rated anything yet.</p>
        )
      ) : (
        <p className="px-4 text-sm text-muted">
          {status === "received"
            ? `${user.full_name} wants to be friends.`
            : "Become friends to see their rankings and notes."}
        </p>
      )}
    </div>
  );
}
