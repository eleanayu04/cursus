import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/neon-auth";

// Proxies the SDK's browser calls to Floo's sign-in service. Resolved per
// request because the sign-in env vars don't exist at build time.
type Context = { params: Promise<{ path: string[] }> };

const proxied = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE") => (req: NextRequest, ctx: Context) =>
  getAuth().handler()[method](req, ctx);

export const GET = proxied("GET");
export const POST = proxied("POST");
export const PUT = proxied("PUT");
export const PATCH = proxied("PATCH");
export const DELETE = proxied("DELETE");
