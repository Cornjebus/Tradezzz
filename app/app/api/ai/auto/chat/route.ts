import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies AI auto-chat requests to the
 * Neural Trading API's /api/ai/auto/chat endpoint. This lets the
 * backend AIRoutingService choose the provider/model.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyRequest("/api/ai/auto/chat", request, {
    method: "POST",
    body,
  });
}
