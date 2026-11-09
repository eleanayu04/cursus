import Link from "next/link";
import { toggleWant } from "@/app/actions";
import { listSubjects, myCourseMarks, searchCourses } from "@/lib/queries";
import { SaveCourseButton } from "./SaveCourseButton";
import { Card, CourseRow, Empty } from "./ui";

/**
 * Search box + subject chips + results. Rows link to `${linkBase}/${id}`.
 * Pass `saveFor` (a user id) to show a Want to take bookmark on courses they haven't rated.
 */
export async function CourseSearch({
  basePath,
  linkBase,
  q = "",
  subject,
  placeholder = "Search courses, e.g. ECON 201 or Data Structures",
  saveFor,
}: {
  basePath: string;
  linkBase: string;
  q?: string;
  subject?: string;
  placeholder?: string;
  saveFor?: string;
}) {
  const [subjects, results, marks] = await Promise.all([
    listSubjects(),
    searchCourses(q, subject),
    saveFor ? myCourseMarks(saveFor) : null,
  ]);
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
            {results.map((c) => {
              const row = <CourseRow course={c} href={`${linkBase}/${c.id}`} />;
              if (!marks || marks.rated.has(Number(c.id))) return <div key={c.id}>{row}</div>;
              const saved = marks.wanted.has(Number(c.id));
              return (
                <div key={c.id} className="flex items-center">
                  <div className="min-w-0 flex-1">{row}</div>
                  <SaveCourseButton
                    code={c.code}
                    saved={saved}
                    action={toggleWant.bind(null, c.id, !saved)}
                  />
                </div>
              );
            })}
          </Card>
        ) : (
          <Empty>No courses match “{q}”.</Empty>
        )
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 px-4">
          {subjects.map((s) => (
            <Link
              key={s.code}
              href={`${basePath}?subject=${encodeURIComponent(s.code)}`}
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
