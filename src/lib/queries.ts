import "server-only";
import { pool, query, queryOne, transaction } from "./db";
import type { Bucket, Visibility } from "./rating";

// Every function that returns another user's data decides here what leaves
// the server. Rules:
//   * a score is null unless its owner has rated UNLOCK_AT (4) courses
//   * notes marked 'private' never leave; 'friends' only go to friends
//   * public notes from non-friends are returned without any identity

export type Course = { id: number; subject: string; number: string; code: string; title: string };
export type CourseWithStats = Course & { avg_score: number | null; rating_count: number };
export type Subject = { code: string; name: string };

export type NoteFields = {
  professor: string | null;
  semester: string | null;
  workload: number | null;
  attendance: boolean | null;
  grading: string | null;
  note: string | null;
};

const unlockedScore = (alias: string) =>
  `case when exists (select 1 from unlocked_users uu where uu.user_id = ${alias}.user_id)
        then ${alias}.score end`;

// Notes are visible to the viewer if public, or 'friends' and the viewer is a friend.
const noteCols = (alias: string, visible: string) =>
  ["professor", "semester", "workload", "attendance", "grading", "note"]
    .map((c) => `case when ${visible} then ${alias}.${c} end as ${c}`)
    .join(", ");

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function listSubjects() {
  return query<Subject & { course_count: number }>(
    `select s.code, s.name, count(c.id)::int as course_count
     from subjects s left join courses c on c.subject = s.code
     group by s.code order by s.code`,
  );
}

// Common shorthand people type for Duke subject codes.
const SUBJECT_ALIASES: Record<string, string> = {
  CS: "COMPSCI",
  BIO: "BIOLOGY",
  STATS: "STA",
  STAT: "STA",
  PSYCH: "PSY",
  POLISCI: "POLSCI",
  PPS: "PUBPOL",
  PHYS: "PHYSICS",
};

export async function searchCourses(q: string, subject?: string): Promise<CourseWithStats[]> {
  let text = q.trim().toUpperCase().replace(/\s+/g, " ");
  const first = text.split(" ")[0];
  if (SUBJECT_ALIASES[first]) text = SUBJECT_ALIASES[first] + text.slice(first.length);
  if (!text && !subject) return [];

  const courses = await query<Course>(
    `select id, subject, number, code, title from courses
     where ($1 = '' or code ilike $2 or replace(code, ' ', '') ilike $2 or title ilike $2)
       and ($3::text is null or subject = $3)
     order by subject,
              nullif(regexp_replace(number, '\\D', '', 'g'), '')::int nulls last, number
     limit 60`,
    [text, `%${text.replace(/[%_\\]/g, "\\$&")}%`, subject ?? null],
  );
  return withStats(courses);
}

export async function getCourse(id: number) {
  const rows = await query<Course>(
    "select id, subject, number, code, title from courses where id = $1",
    [id],
  );
  if (!rows[0]) return null;
  return (await withStats(rows))[0];
}

// Campus average per course, counting only unlocked users.
async function withStats(courses: Course[]): Promise<CourseWithStats[]> {
  if (courses.length === 0) return [];
  const stats = await query<{ course_id: number; avg_score: number; rating_count: number }>(
    `select r.course_id, round(avg(r.score), 1) as avg_score, count(*)::int as rating_count
     from ratings r join unlocked_users u using (user_id)
     where r.course_id = any ($1)
     group by r.course_id`,
    [courses.map((c) => c.id)],
  );
  const byId = new Map(stats.map((s) => [s.course_id, s]));
  return courses.map((c) => ({
    ...c,
    avg_score: byId.get(c.id)?.avg_score ?? null,
    rating_count: byId.get(c.id)?.rating_count ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// My ratings
// ---------------------------------------------------------------------------

export type MyRating = NoteFields & {
  id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  bucket: Bucket;
  rank: number;
  score: number;
  visibility: Visibility;
  created_at: Date;
};

const MY_RATING_SELECT = `
  select r.id, r.course_id, c.code as course_code, c.title as course_title,
         r.bucket, r.rank, r.score, r.visibility, r.professor, r.semester,
         r.workload, r.attendance, r.grading, r.note, r.created_at
  from ratings r join courses c on c.id = r.course_id`;

export async function myRatings(userId: string) {
  return query<MyRating>(`${MY_RATING_SELECT} where r.user_id = $1 order by r.score desc, r.id`, [
    userId,
  ]);
}

export async function myRating(userId: string, courseId: number) {
  return queryOne<MyRating>(`${MY_RATING_SELECT} where r.user_id = $1 and r.course_id = $2`, [
    userId,
    courseId,
  ]);
}

export async function myRatingCount(userId: string) {
  const row = await queryOne<{ n: number }>(
    "select count(*)::int as n from ratings where user_id = $1",
    [userId],
  );
  return row?.n ?? 0;
}

/** My courses in one bucket, least liked first — the comparison candidates. */
export async function myBucket(userId: string, bucket: Bucket) {
  return query<{ course_id: number; course_code: string; course_title: string; rank: number }>(
    `select r.course_id, c.code as course_code, c.title as course_title, r.rank
     from ratings r join courses c on c.id = r.course_id
     where r.user_id = $1 and r.bucket = $2 order by r.rank`,
    [userId, bucket],
  );
}

export type RatingInput = NoteFields & {
  courseId: number;
  bucket: Bucket;
  rank: number;
  visibility: Visibility;
};

/** Inserts at `rank` within the bucket, shifts the ones above, rescores. */
export async function submitRating(userId: string, input: RatingInput) {
  return transaction(async (db) => {
    // serialize a user's own submissions so ranks can't interleave
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);

    const exists = await db.query(
      "select 1 from ratings where user_id = $1 and course_id = $2",
      [userId, input.courseId],
    );
    if (exists.rowCount) throw new Error("You already rated this course.");

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from ratings where user_id = $1 and bucket = $2",
      [userId, input.bucket],
    );
    const n = rows[0].n;
    if (!Number.isInteger(input.rank) || input.rank < 0 || input.rank > n) {
      throw new Error("Your rankings changed while you were comparing. Please try again.");
    }

    await db.query(
      "update ratings set rank = rank + 1 where user_id = $1 and bucket = $2 and rank >= $3",
      [userId, input.bucket, input.rank],
    );
    await db.query(
      `insert into ratings (user_id, course_id, bucket, rank, professor, semester,
                            workload, attendance, grading, note, visibility)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        userId,
        input.courseId,
        input.bucket,
        input.rank,
        input.professor,
        input.semester,
        input.workload,
        input.attendance,
        input.grading,
        input.note,
        input.visibility,
      ],
    );
    await db.query("select rescore_bucket($1, $2)", [userId, input.bucket]);

    const result = await db.query<{ score: number; total: number }>(
      `select score, (select count(*)::int from ratings where user_id = $1) as total
       from ratings where user_id = $1 and course_id = $2`,
      [userId, input.courseId],
    );
    return result.rows[0];
  });
}

/**
 * Moves an existing rating to `rank` within `bucket` (which may be its current
 * bucket), with `rank` counted among the user's *other* courses in that bucket.
 * Closes the gap it leaves, opens one where it lands, rescores both buckets.
 */
export async function rerankRating(userId: string, input: RatingInput) {
  return transaction(async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);

    const { rows: current } = await db.query<{ bucket: Bucket; rank: number }>(
      "select bucket, rank from ratings where user_id = $1 and course_id = $2",
      [userId, input.courseId],
    );
    if (!current[0]) throw new Error("You haven't rated this course yet.");
    const old = current[0];

    // take it out of its old spot
    await db.query(
      "update ratings set rank = rank - 1 where user_id = $1 and bucket = $2 and rank > $3",
      [userId, old.bucket, old.rank],
    );

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from ratings
       where user_id = $1 and bucket = $2 and course_id <> $3`,
      [userId, input.bucket, input.courseId],
    );
    if (!Number.isInteger(input.rank) || input.rank < 0 || input.rank > rows[0].n) {
      throw new Error("Your rankings changed while you were comparing. Please try again.");
    }

    // make room in the new spot, then move it there
    await db.query(
      `update ratings set rank = rank + 1
       where user_id = $1 and bucket = $2 and rank >= $3 and course_id <> $4`,
      [userId, input.bucket, input.rank, input.courseId],
    );
    await db.query(
      `update ratings set bucket = $3, rank = $4, professor = $5, semester = $6,
              workload = $7, attendance = $8, grading = $9, note = $10, visibility = $11
       where user_id = $1 and course_id = $2`,
      [
        userId,
        input.courseId,
        input.bucket,
        input.rank,
        input.professor,
        input.semester,
        input.workload,
        input.attendance,
        input.grading,
        input.note,
        input.visibility,
      ],
    );
    await db.query("select rescore_bucket($1, $2)", [userId, old.bucket]);
    if (input.bucket !== old.bucket) {
      await db.query("select rescore_bucket($1, $2)", [userId, input.bucket]);
    }

    const result = await db.query<{ score: number; total: number }>(
      `select score, (select count(*)::int from ratings where user_id = $1) as total
       from ratings where user_id = $1 and course_id = $2`,
      [userId, input.courseId],
    );
    return result.rows[0];
  });
}

/** Changes notes and who can see them; the ranking stays put. */
export async function updateRatingNotes(
  userId: string,
  courseId: number,
  notes: NoteFields & { visibility: Visibility },
) {
  const { rowCount } = await pool.query(
    `update ratings set professor = $3, semester = $4, workload = $5, attendance = $6,
            grading = $7, note = $8, visibility = $9
     where user_id = $1 and course_id = $2`,
    [
      userId,
      courseId,
      notes.professor,
      notes.semester,
      notes.workload,
      notes.attendance,
      notes.grading,
      notes.note,
      notes.visibility,
    ],
  );
  if (!rowCount) throw new Error("You haven't rated this course yet.");
}

// ---------------------------------------------------------------------------
// What others see
// ---------------------------------------------------------------------------

export type FriendRating = NoteFields & {
  username: string;
  full_name: string;
  bucket: Bucket;
  score: number | null;
  created_at: Date;
};

export async function courseFriendRatings(viewerId: string, courseId: number) {
  return query<FriendRating>(
    `select u.username, u.full_name, r.bucket, ${unlockedScore("r")} as score,
            ${noteCols("r", "r.visibility <> 'private'")}, r.created_at
     from ratings r
     join friends f on f.friend_id = r.user_id and f.user_id = $1
     join users u on u.id = r.user_id
     where r.course_id = $2
     order by r.score desc`,
    [viewerId, courseId],
  );
}

export type AnonymousNote = NoteFields & {
  bucket: Bucket;
  score: number | null;
  created_at: Date;
};

/** Public notes with no identity. Excludes mine and my friends' (shown named). */
export async function coursePublicNotes(viewerId: string, courseId: number) {
  return query<AnonymousNote>(
    `select r.bucket, ${unlockedScore("r")} as score, r.professor, r.semester,
            r.workload, r.attendance, r.grading, r.note, r.created_at
     from ratings r
     where r.course_id = $2
       and r.visibility = 'public'
       and r.user_id <> $1
       and not exists (select 1 from friends f where f.user_id = $1 and f.friend_id = r.user_id)
       and coalesce(r.note, r.grading, r.professor, r.semester) is not null
     order by r.created_at desc
     limit 100`,
    [viewerId, courseId],
  );
}

export type FeedItem = {
  username: string;
  full_name: string;
  course_id: number;
  course_code: string;
  course_title: string;
  bucket: Bucket;
  score: number | null;
  note: string | null;
  created_at: Date;
};

export async function friendFeed(viewerId: string) {
  return query<FeedItem>(
    `select u.username, u.full_name, c.id as course_id, c.code as course_code,
            c.title as course_title, r.bucket, ${unlockedScore("r")} as score,
            case when r.visibility <> 'private' then r.note end as note, r.created_at
     from ratings r
     join friends f on f.friend_id = r.user_id and f.user_id = $1
     join users u on u.id = r.user_id
     join courses c on c.id = r.course_id
     order by r.created_at desc
     limit 50`,
    [viewerId],
  );
}

/** A friend's ranked list; empty unless the two are friends. */
export async function friendRatings(viewerId: string, friendId: string) {
  return query<{
    course_id: number;
    course_code: string;
    course_title: string;
    bucket: Bucket;
    score: number | null;
    note: string | null;
  }>(
    `select c.id as course_id, c.code as course_code, c.title as course_title, r.bucket,
            ${unlockedScore("r")} as score,
            case when r.visibility <> 'private' then r.note end as note
     from ratings r
     join friends f on f.friend_id = r.user_id and f.user_id = $1
     join courses c on c.id = r.course_id
     where r.user_id = $2
     order by r.score desc`,
    [viewerId, friendId],
  );
}

// ---------------------------------------------------------------------------
// People & friends
// ---------------------------------------------------------------------------

export type Person = { id: string; username: string; full_name: string };

export async function getUserByUsername(username: string) {
  return queryOne<Person>(
    "select id, username, full_name from users where username = $1",
    [username.toLowerCase()],
  );
}

export async function searchPeople(viewerId: string, q: string) {
  const term = q.trim().replace(/^@/, "");
  if (!term) return [];
  return query<Person>(
    `select id, username, full_name from users
     where username is not null and id <> $1
       and (username ilike $2 or full_name ilike $2)
     order by username limit 20`,
    [viewerId, `%${term.replace(/[%_\\]/g, "\\$&")}%`],
  );
}

export type FriendStatus = "none" | "friends" | "sent" | "received";

export async function friendStatus(viewerId: string, otherId: string): Promise<FriendStatus> {
  const row = await queryOne<{ requester: string; status: string }>(
    `select requester, status from friendships
     where (requester = $1 and addressee = $2) or (requester = $2 and addressee = $1)`,
    [viewerId, otherId],
  );
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester === viewerId ? "sent" : "received";
}

export async function listFriends(userId: string) {
  return query<Person>(
    `select u.id, u.username, u.full_name from friends f join users u on u.id = f.friend_id
     where f.user_id = $1 order by u.full_name`,
    [userId],
  );
}

export async function pendingRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    query<Person>(
      `select u.id, u.username, u.full_name from friendships fr join users u on u.id = fr.requester
       where fr.addressee = $1 and fr.status = 'pending' order by fr.created_at desc`,
      [userId],
    ),
    query<Person>(
      `select u.id, u.username, u.full_name from friendships fr join users u on u.id = fr.addressee
       where fr.requester = $1 and fr.status = 'pending' order by fr.created_at desc`,
      [userId],
    ),
  ]);
  return { incoming, outgoing };
}

/** Sends a request, or accepts if the other person already asked. */
export async function requestFriend(viewerId: string, otherId: string) {
  if (viewerId === otherId) return;
  const status = await friendStatus(viewerId, otherId);
  if (status === "received") return acceptFriend(viewerId, otherId);
  if (status !== "none") return;
  await query(
    `insert into friendships (requester, addressee) values ($1, $2) on conflict do nothing`,
    [viewerId, otherId],
  );
}

export async function acceptFriend(viewerId: string, requesterId: string) {
  await query(
    `update friendships set status = 'accepted'
     where requester = $2 and addressee = $1 and status = 'pending'`,
    [viewerId, requesterId],
  );
}

/** Unfriend, cancel a sent request, or decline a received one. */
export async function removeFriendship(viewerId: string, otherId: string) {
  await query(
    `delete from friendships
     where (requester = $1 and addressee = $2) or (requester = $2 and addressee = $1)`,
    [viewerId, otherId],
  );
}

// ---------------------------------------------------------------------------
// Want-to-take
// ---------------------------------------------------------------------------

export async function wantList(userId: string) {
  return withStats(
    await query<Course>(
      `select c.id, c.subject, c.number, c.code, c.title
       from want_list w join courses c on c.id = w.course_id
       where w.user_id = $1 order by w.created_at desc`,
      [userId],
    ),
  );
}

export async function isWanted(userId: string, courseId: number) {
  return !!(await queryOne(
    "select 1 from want_list where user_id = $1 and course_id = $2",
    [userId, courseId],
  ));
}

/** The courses this user has saved or rated, for marking up search results. */
export async function myCourseMarks(userId: string) {
  const [wanted, rated] = await Promise.all([
    query<{ id: number }>("select course_id::int as id from want_list where user_id = $1", [
      userId,
    ]),
    query<{ id: number }>("select course_id::int as id from ratings where user_id = $1", [userId]),
  ]);
  return {
    wanted: new Set(wanted.map((r) => r.id)),
    rated: new Set(rated.map((r) => r.id)),
  };
}

export async function setWanted(userId: string, courseId: number, wanted: boolean) {
  await query(
    wanted
      ? "insert into want_list (user_id, course_id) values ($1, $2) on conflict do nothing"
      : "delete from want_list where user_id = $1 and course_id = $2",
    [userId, courseId],
  );
}
