import { safeNext } from "@/lib/access";
import { AuthFlow } from "../AuthFlow";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthFlow start="forgot" next={safeNext((await searchParams).next)} />;
}
