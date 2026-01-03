/**
 * Proxy utility for forwarding requests to the Neural Trading API
 * with authentication token forwarding and error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const DEFAULT_TIMEOUT = 30000; // 30 seconds

interface ProxyOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  timeout?: number;
  requireAuth?: boolean;
}

interface ProxyResult {
  data: unknown;
  status: number;
  ok: boolean;
}

/**
 * Get the backend API base URL
 */
export function getBackendUrl(): string {
  return process.env.NEURAL_TRADING_API_URL || "http://localhost:3001";
}

/**
 * Forward a request to the Neural Trading API with auth token
 */
export async function proxyToBackend(
  path: string,
  request: NextRequest | null,
  options: ProxyOptions = {}
): Promise<ProxyResult> {
  const {
    method = "GET",
    body,
    timeout = DEFAULT_TIMEOUT,
    requireAuth: requireAuthentication = true,
  } = options;

  const baseUrl = getBackendUrl();
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;

  // Get auth token from Clerk
  const { getToken } = await auth();
  const token = await getToken();

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward auth token if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (requireAuthentication) {
    return {
      data: { success: false, error: "Unauthorized" },
      status: 401,
      ok: false,
    };
  }

  // Forward any existing Authorization header from the request
  if (request?.headers.get("Authorization") && !token) {
    headers["Authorization"] = request.headers.get("Authorization")!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    return {
      data,
      status: response.status,
      ok: response.ok,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        data: { success: false, error: "Request timeout" },
        status: 504,
        ok: false,
      };
    }

    console.error(`Proxy error for ${path}:`, error);
    return {
      data: { success: false, error: "Backend service unavailable" },
      status: 503,
      ok: false,
    };
  }
}

/**
 * Create a NextResponse from a proxy result
 */
export function createProxyResponse(result: ProxyResult): NextResponse {
  return NextResponse.json(result.data, { status: result.status });
}

/**
 * Convenience function to proxy and return response
 */
export async function proxyRequest(
  path: string,
  request: NextRequest | null,
  options: ProxyOptions = {}
): Promise<NextResponse> {
  const result = await proxyToBackend(path, request, options);
  return createProxyResponse(result);
}
