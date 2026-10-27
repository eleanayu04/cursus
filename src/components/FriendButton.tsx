import { acceptFriendRequest, addFriend, removeFriend } from "@/app/actions";
import type { FriendStatus } from "@/lib/queries";

const base = "rounded-xl px-4 py-2 text-sm font-semibold";

export function FriendButton({ userId, status }: { userId: string; status: FriendStatus }) {
  if (status === "none") {
    return (
      <form action={addFriend.bind(null, userId)}>
        <button className={`${base} bg-accent text-white`}>Add friend</button>
      </form>
    );
  }
  if (status === "received") {
    return (
      <div className="flex gap-2">
        <form action={acceptFriendRequest.bind(null, userId)}>
          <button className={`${base} bg-accent text-white`}>Accept</button>
        </form>
        <form action={removeFriend.bind(null, userId)}>
          <button className={`${base} border border-line bg-surface`}>Decline</button>
        </form>
      </div>
    );
  }
  return (
    <form action={removeFriend.bind(null, userId)}>
      <button className={`${base} border border-line bg-surface`}>
        {status === "sent" ? "Cancel request" : "Unfriend"}
      </button>
    </form>
  );
}
