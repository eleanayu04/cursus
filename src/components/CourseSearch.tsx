import Link from "next/link";
import { listSubjects, searchCourses } from "@/lib/queries";
import { Card, CourseRow, Empty } from "./ui";

/** Search box + subject chips + results. Rows link to `${linkBase}/${id}`. */
export async function CourseSearch({
  basePath,
  linkBase,
  q = "",
  subject,
  placeholder = "Search courses, e.g. ECON 201 or Data Structures",
}: {
  basePath: string;
  linkBase: string;
  q?: string;
  subject?: string;
  placeholder?: string;
}) {
  const [subjects, results] = await Promise.all([listSubjects(), searchCourses(q, subject)]);
  const searching = q.trim() !== "" || !!subject;

  return (
    <div>
      <form action={basePath} className="px-4">
        {subject && <input type="hidden" name="subject" value={subject} />}
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
      </form>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {subjects.map((s) => {
          const on = s.code === subject;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (!on) params.set("subject", s.code);
          return (
            <Link
              key={s.code}
              href={`${basePath}?${params}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
              }`}
            >
              {s.code}
            </Link>
          );
        })}
      </div>

      {searching ? (
        results.length ? (
          <Card className="mx-4 mt-3 divide-y divide-line overflow-hidden">
            {results.map((c) => (
              <CourseRow key={c.id} course={c} href={`${linkBase}/${c.id}`} />
            ))}
          </Card>
        ) : (
          <Empty>No courses match “{q}”.</Empty>
        )
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 px-4">
          {subjects.map((s) => (
            <Link
              key={s.code}
              href={`${basePath}?subject=${s.code}`}
              className="rounded-2xl border border-line bg-surface px-3 py-3"
            >
              <div className="text-sm font-semibold">{s.code}</div>
              <div className="truncate text-xs text-muted">
                {s.name} · {s.course_count}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
