import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy";

/**
 * Next.js API route that proxies strategy explanation requests to the
 * Neural Trading API. The backend builds a context from Neon + RuVector
 * and, when possible, an AI-generated explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Strategy id is required" },
      { status: 400 },
    );
  }

  return proxyRequest(`/api/patterns/strategies/${encodeURIComponent(id)}/explain`, request);
}
