-- Cursus schema (plain Postgres, Floo managed).
--
-- Only the Next.js server talks to this database, so access control lives in
-- src/lib/queries.ts: every query that returns other people's data decides
-- there which columns (and whose identity) can leave the server.

-- ---------------------------------------------------------------------------
-- Accounts & auth (email one-time codes, cookie sessions)
-- ---------------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email like '%@duke.edu'),
  -- null until the user finishes onboarding
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  full_name text check (char_length(full_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table login_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table subjects (
  code text primary key,
  name text not null
);

create table courses (
  id bigint generated always as identity primary key,
  subject text not null references subjects on update cascade,
  number text not null,
  title text not null,
  code text generated always as (subject || ' ' || number) stored,
  unique (subject, number)
);

-- ---------------------------------------------------------------------------
-- Ratings
-- ---------------------------------------------------------------------------

create type rating_bucket as enum ('disliked', 'fine', 'liked');
-- who can read the notes. Scores always count toward campus averages and are
-- always visible to friends.
create type note_visibility as enum ('public', 'friends', 'private');

create table ratings (
  id bigint generated always as identity primary key,
  user_id uuid not null references users on delete cascade,
  course_id bigint not null references courses on delete cascade,
  bucket rating_bucket not null,
  -- position within the user's bucket, 0 = least liked. Contiguous 0..n-1.
  rank int not null check (rank >= 0),
  score numeric(3, 1) not null default 0,
  professor text check (char_length(professor) <= 80),
  semester text check (char_length(semester) <= 20),
  workload smallint check (workload between 1 and 5),
  attendance boolean,
  grading text check (char_length(grading) <= 200),
  note text check (char_length(note) <= 2000),
  visibility note_visibility not null default 'public',
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index ratings_course_idx on ratings (course_id);
create index ratings_user_bucket_idx on ratings (user_id, bucket, rank);

-- Score ranges per bucket: Disliked 0–3.3, Fine 3.4–6.7, Liked 6.8–10.
create function bucket_lo(b rating_bucket) returns numeric
language sql immutable as $$
  select case b when 'disliked' then 0.0 when 'fine' then 3.4 else 6.8 end
$$;

create function bucket_hi(b rating_bucket) returns numeric
language sql immutable as $$
  select case b when 'disliked' then 3.3 when 'fine' then 6.7 else 10.0 end
$$;

-- Spread a user's bucket evenly across its range: with n courses, rank r
-- scores lo + (hi - lo) * (r + 1) / (n + 1).
create function rescore_bucket(p_user uuid, p_bucket rating_bucket) returns void
language sql as $$
  with c as (
    select count(*) as n from ratings where user_id = p_user and bucket = p_bucket
  )
  update ratings r
  set score = round(
    bucket_lo(p_bucket)
      + (bucket_hi(p_bucket) - bucket_lo(p_bucket)) * (r.rank + 1)::numeric / (c.n + 1),
    1)
  from c
  where r.user_id = p_user and r.bucket = p_bucket
$$;

-- Users need 4 rated courses before their scores show or count anywhere.
create view unlocked_users as
  select user_id from ratings group by user_id having count(*) >= 4;

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------

create table friendships (
  requester uuid not null references users on delete cascade,
  addressee uuid not null references users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- one row per pair, whichever direction it was sent in
create unique index friendships_pair_idx on friendships
  (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on friendships (addressee);

-- accepted friendships in both directions, for easy joins
create view friends as
  select requester as user_id, addressee as friend_id from friendships where status = 'accepted'
  union all
  select addressee, requester from friendships where status = 'accepted';

create table want_list (
  user_id uuid not null references users on delete cascade,
  course_id bigint not null references courses on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
