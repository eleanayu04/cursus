// Pure rating logic shared by the server and the rate flow UI.

export type Bucket = "disliked" | "fine" | "liked";
export type Visibility = "public" | "friends" | "private";

export const UNLOCK_AT = 4;

export const BUCKETS: Record<Bucket, { label: string; lo: number; hi: number }> = {
  liked: { label: "I liked it", lo: 6.8, hi: 10 },
  fine: { label: "It was fine", lo: 3.4, hi: 6.7 },
  disliked: { label: "I didn't like it", lo: 0, hi: 3.3 },
};

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Everyone (anonymous)",
  friends: "Friends only",
  private: "Just me",
};

export function bucketForScore(score: number): Bucket {
  if (score >= 6.8) return "liked";
  if (score >= 3.4) return "fine";
  return "disliked";
}

// Mirrors rescore_bucket() in db/migrations/001_init.sql.
export function scoreFor(bucket: Bucket, rank: number, bucketSize: number): number {
  const { lo, hi } = BUCKETS[bucket];
  return Math.round((lo + ((hi - lo) * (rank + 1)) / (bucketSize + 1)) * 10) / 10;
}

// Binary insertion over the user's courses in one bucket, sorted least- to
// most-liked. Each comparison halves the range [lo, hi); when lo === hi that
// is the new course's rank.
export type Search = { lo: number; hi: number };

export const startSearch = (bucketSize: number): Search => ({ lo: 0, hi: bucketSize });
export const isSettled = (s: Search) => s.lo >= s.hi;
export const pivotOf = (s: Search) => Math.floor((s.lo + s.hi) / 2);

export function answer(s: Search, newIsBetter: boolean): Search {
  const mid = pivotOf(s);
  return newIsBetter ? { lo: mid + 1, hi: s.hi } : { lo: s.lo, hi: mid };
}

// "Too close to call": place it right next to the pivot.
export function tie(s: Search): Search {
  const mid = pivotOf(s);
  return { lo: mid + 1, hi: mid + 1 };
}

export function maxComparisons(bucketSize: number): number {
  return bucketSize === 0 ? 0 : Math.ceil(Math.log2(bucketSize + 1));
}
