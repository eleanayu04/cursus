import Link from "next/link";
import { acceptFriendRequest, removeFriend } from "@/app/actions";
import { CopyLink } from "@/components/CopyLink";
import { SignOutButton } from "@/components/SignOutButton";
import { Card, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import {
  friendStatus,
  listFriends,
  myRatingCount,
  pendingRequests,
  searchPeople,
  type Person,
} from "@/lib/queries";
import { FriendButton } from "@/components/FriendButton";

function PersonRow({ p, children }: { p: Person; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {p.full_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{p.full_name}</div>
          <div className="truncate text-xs text-muted">@{p.username}</div>
        </div>
      </Link>
      {children}
    </div>
  );
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireProfile();
  const q = (await searchParams).q ?? "";
  const [friends, requests, count, found] = await Promise.all([
    listFriends(me.id),
    pendingRequests(me.id),
    myRatingCount(me.id),
    searchPeople(me.id, q),
  ]);
  const foundWithStatus = await Promise.all(
    found.map(async (p) => ({ p, status: await friendStatus(me.id, p.id) })),
  );

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title={me.full_name} subtitle={`@${me.username} · ${me.email}`} />

      <div className="grid grid-cols-2 gap-2 px-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{count}</div>
          <div className="text-xs text-muted">courses rated</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{friends.length}</div>
          <div className="text-xs text-muted">friends</div>
        </Card>
      </div>

      <section className="px-4">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
          Invite friends
        </h2>
        <Card className="p-3">
          <CopyLink path={`/invite/${me.username}`} />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 px-4 text-sm font-semibold tracking-wide text-muted uppercase">
          Find people
        </h2>
        <form action="/profile" className="px-4">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name or @username"
            autoCapitalize="none"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
          />
        </form>
        {q && (
          <Card className="mx-4 mt-2 divide-y divide-line">
            {foundWithStatus.length ? (
              foundWithStatus.map(({ p, status }) => (
                <PersonRow key={p.id} p={p}>
                  <FriendButton userId={p.id} status={status} />
                </PersonRow>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-muted">No one found.</p>
            )}
          </Card>
        )}
      </section>

      {requests.incoming.length > 0 && (
        <section>
          <h2 className="mb-2 px-4 text-sm font-semibold tracking-wide text-muted uppercase">
            Friend requests
          </h2>
          <Card className="mx-4 divide-y divide-line">
            {requests.incoming.map((p) => (
              <PersonRow key={p.id} p={p}>
                <form action={acceptFriendRequest.bind(null, p.id)}>
                  <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                    Accept
                  </button>
                </form>
                <form action={removeFriend.bind(null, p.id)}>
                  <button className="px-2 py-1.5 text-xs text-muted">Decline</button>
                </form>
              </PersonRow>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-2 px-4 text-sm font-semibold tracking-wide text-muted uppercase">
          Friends
        </h2>
        {friends.length ? (
          <Card className="mx-4 divide-y divide-line">
            {friends.map((p) => (
              <PersonRow key={p.id} p={p} />
            ))}
          </Card>
        ) : (
          <p className="px-4 text-sm text-muted">
            No friends yet — share your invite link or search above.
          </p>
        )}
        {requests.outgoing.length > 0 && (
          <p className="mt-2 px-4 text-xs text-muted">
            Pending: {requests.outgoing.map((p) => `@${p.username}`).join(", ")}
          </p>
        )}
      </section>

      <div className="px-4">
        <SignOutButton />
      </div>
    </div>
  );
}
