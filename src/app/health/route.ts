import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await query("select 1");
  return new Response("ok");
}
