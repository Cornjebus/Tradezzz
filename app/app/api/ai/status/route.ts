import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies AI runtime status from the
 * Neon/NeuralTradingServer. This is used to show whether the
 * adapter-backed AI layer is wired up.
 */
export async function GET() {
  return proxyRequest("/api/ai/status", null);
}
