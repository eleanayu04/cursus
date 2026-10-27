import { TabBar } from "@/components/TabBar";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  return (
    <>
      <main className="pb-24">{children}</main>
      <TabBar />
    </>
  );
}
