import { NextResponse } from "next/server";

/**
 * Next.js API route that proxies RuVector / pattern engine health
 * from the Neon/NeuralTradingServer.
 */
export async function GET() {
  try {
    const baseUrl = process.env.NEURAL_TRADING_API_URL || "http://localhost:3001";

    const res = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/patterns/health`,
      {
        cache: "no-store",
      },
    );

    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (error: any) {
    console.error("Pattern health proxy error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load pattern engine health" },
      { status: 500 },
    );
  }
}
