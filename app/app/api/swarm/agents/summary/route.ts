import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies swarm agent summary from the
 * Neon/NeuralTradingServer. This is used to power a simple
 * agent leaderboard view.
 */
export async function GET() {
  return proxyRequest("/api/swarm/agents/summary", null);
}
