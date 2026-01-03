import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies strategy recommendations from the
 * Neural Trading API (Express / Neon server). This keeps the frontend
 * decoupled from the backend base URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = searchParams.get("limit") || "5";
  return proxyRequest(`/api/patterns/strategies/recommend?limit=${encodeURIComponent(limit)}`, request);
}
