import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getCourse, myBucket, myRating, myRatingCount } from "@/lib/queries";
import { RateFlow } from "./RateFlow";

export default async function RateCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const me = await requireProfile();
  const courseId = Number((await params).courseId);
  if (!Number.isInteger(courseId)) notFound();
  const { mode } = await searchParams;

  const [course, existing, count, liked, fine, disliked] = await Promise.all([
    getCourse(courseId),
    myRating(me.id, courseId),
    myRatingCount(me.id),
    myBucket(me.id, "liked"),
    myBucket(me.id, "fine"),
    myBucket(me.id, "disliked"),
  ]);
  if (!course) notFound();

  // When re-ranking, the course is compared only against your *other*
  // courses, so leave it out of its own bucket.
  const others = (list: typeof liked) => list.filter((r) => r.course_id !== courseId);

  // No redirect when already rated: saving revalidates this page, and the
  // flow still needs to show its result screen.
  return (
    <RateFlow
      course={{ id: course.id, code: course.code, title: course.title }}
      existing={existing}
      mode={mode === "edit" ? "edit" : mode === "rerank" ? "rerank" : "new"}
      ratedCount={count}
      buckets={{ liked: others(liked), fine: others(fine), disliked: others(disliked) }}
    />
  );
}
