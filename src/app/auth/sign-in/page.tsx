import { redirect } from "next/navigation";
import { safeNext } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { AuthFlow } from "../AuthFlow";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <AuthFlow start="sign-in" next={next} />;
}
