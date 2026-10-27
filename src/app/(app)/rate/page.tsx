import { CourseSearch } from "@/components/CourseSearch";
import { PageHeader, UnlockBanner } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { myRatingCount } from "@/lib/queries";

export default async function RatePickPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; subject?: string }>;
}) {
  const me = await requireProfile();
  const [{ q, subject }, count] = await Promise.all([searchParams, myRatingCount(me.id)]);
  return (
    <>
      <PageHeader title="Rate a course" subtitle="Pick a course you've taken" />
      <UnlockBanner count={count} />
      <CourseSearch
        basePath="/rate"
        linkBase="/rate"
        q={q}
        subject={subject}
        placeholder="Which course did you take?"
      />
    </>
  );
}
