import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies strategy generation requests to the
 * Neural Trading API. The backend uses RuVector + AI routing to
 * propose and persist a new draft strategy.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyRequest("/api/patterns/strategies/generate", request, {
    method: "POST",
    body,
  });
}
