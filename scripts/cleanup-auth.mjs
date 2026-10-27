// Nightly: drop expired sessions and login codes.
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const s = await client.query("delete from sessions where expires_at < now()");
const c = await client.query("delete from login_codes where expires_at < now() - interval '1 day'");
console.log(`removed ${s.rowCount} sessions, ${c.rowCount} login codes`);
await client.end();
