import { CourseSearch } from "@/components/CourseSearch";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string }>;
}) {
  const me = await requireProfile();
  const { q, subject } = await searchParams;
  return (
    <>
      <PageHeader title="Search" subtitle="Campus averages from students with 4+ ratings" />
      <CourseSearch basePath="/search" linkBase="/course" q={q} subject={subject} saveFor={me.id} />
    </>
  );
}
