import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies the Neon/NeuralTradingServer
 * graph risk endpoint. This keeps the frontend decoupled from
 * the backend base URL while exposing RuVector-aware risk data.
 */
export async function GET() {
  return proxyRequest("/api/risk/graph", null);
}
