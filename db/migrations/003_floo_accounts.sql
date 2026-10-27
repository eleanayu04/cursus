-- Sign-in moved to Floo accounts mode: Floo's gateway authenticates users,
-- so Cursus no longer stores login codes or sessions.
drop table login_codes;
drop table sessions;

-- Duke-only is now enforced in the app (src/lib/auth.ts) so the app owner can
-- also sign in with a non-Duke Floo account for testing.
alter table users drop constraint users_email_check;
alter table users add constraint users_email_lowercase check (email = lower(email));
