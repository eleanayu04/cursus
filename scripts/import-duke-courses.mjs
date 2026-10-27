// Imports the Duke course catalog from the Duke OIT Curriculum API
// (https://streamer.oit.duke.edu). Upserts on (subject, number), so existing
// ratings stay attached when titles change.
//
//   DUKE_API_TOKEN=... DATABASE_URL=... node scripts/import-duke-courses.mjs [SUBJECT ...]
//
// With no arguments it imports every subject. Response shapes below follow the
// API's PeopleSoft-style JSON; check a single subject first (e.g. `ECON`).
import pg from "pg";

const token = process.env.DUKE_API_TOKEN;
if (!token) {
  console.error("Set DUKE_API_TOKEN (get one at https://streamer.oit.duke.edu/dev_manager).");
  process.exit(1);
}
const BASE = "https://streamer.oit.duke.edu/curriculum";
const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function get(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}access_token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function listSubjects() {
  const json = await get("/list_of_values/fieldname/SUBJECT");
  return asArray(json?.scc_lov_resp?.lovs?.lov?.values?.value).map((v) => {
    // values look like {code: "ECON", desc: "ECON - Economics"}
    const name = String(v.desc ?? v.code).replace(/^[A-Z&-]+\s*-\s*/, "");
    return { code: String(v.code).trim(), name: name.trim() };
  });
}

async function listCourses(subject) {
  const json = await get(`/courses/subject/${encodeURIComponent(`${subject.code} - ${subject.name}`)}`);
  const summaries = asArray(
    json?.ssr_get_courses_resp?.course_search_result?.subjects?.subject?.course_summaries
      ?.course_summary,
  );
  const seen = new Map();
  for (const c of summaries) {
    const number = String(c.catalog_nbr ?? "").trim();
    const title = String(c.course_title_long ?? c.descr ?? "").trim();
    if (number && title) seen.set(number, title); // last offering wins
  }
  return [...seen].map(([number, title]) => ({ number, title }));
}

const only = new Set(process.argv.slice(2).map((s) => s.toUpperCase()));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let total = 0;
try {
  const subjects = (await listSubjects()).filter((s) => only.size === 0 || only.has(s.code));
  console.log(`${subjects.length} subjects`);
  for (const subject of subjects) {
    let courses;
    try {
      courses = await listCourses(subject);
    } catch (err) {
      console.warn(`skip ${subject.code}: ${err.message}`);
      continue;
    }
    await client.query("begin");
    await client.query(
      `insert into subjects (code, name) values ($1, $2)
       on conflict (code) do update set name = excluded.name`,
      [subject.code, subject.name],
    );
    for (const c of courses) {
      await client.query(
        `insert into courses (subject, number, title) values ($1, $2, $3)
         on conflict (subject, number) do update set title = excluded.title`,
        [subject.code, c.number, c.title],
      );
    }
    await client.query("commit");
    total += courses.length;
    console.log(`${subject.code}: ${courses.length}`);
  }
} finally {
  await client.end();
}
console.log(`imported ${total} courses`);
