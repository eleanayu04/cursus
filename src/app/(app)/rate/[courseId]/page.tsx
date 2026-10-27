import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getCourse, myBucket, myRating, myRatingCount } from "@/lib/queries";
import { RateFlow } from "./RateFlow";

export default async function RateCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const me = await requireProfile();
  const courseId = Number((await params).courseId);
  if (!Number.isInteger(courseId)) notFound();

  const [course, existing, count, liked, fine, disliked] = await Promise.all([
    getCourse(courseId),
    myRating(me.id, courseId),
    myRatingCount(me.id),
    myBucket(me.id, "liked"),
    myBucket(me.id, "fine"),
    myBucket(me.id, "disliked"),
  ]);
  if (!course) notFound();

  // No redirect when already rated: saving revalidates this page, and the
  // flow still needs to show its result screen.
  return (
    <RateFlow
      course={{ id: course.id, code: course.code, title: course.title }}
      alreadyRated={!!existing}
      ratedCount={count}
      buckets={{ liked, fine, disliked }}
    />
  );
}
