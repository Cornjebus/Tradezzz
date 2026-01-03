import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";
import { encryptApiKey } from "@/lib/encryption";

const SUPPORTED_EXCHANGES = [
  { id: "binance", name: "Binance", logo: "🟡", requiresPassphrase: false },
  { id: "coinbase", name: "Coinbase", logo: "🔵", requiresPassphrase: true },
  { id: "kraken", name: "Kraken", logo: "🟣", requiresPassphrase: false },
  { id: "kucoin", name: "KuCoin", logo: "🟢", requiresPassphrase: true },
  { id: "bybit", name: "Bybit", logo: "🟠", requiresPassphrase: false },
  { id: "okx", name: "OKX", logo: "⚪", requiresPassphrase: true },
];

// Exchanges that require passphrase for API authentication
const EXCHANGES_REQUIRING_PASSPHRASE = ["coinbase", "kucoin", "okx"];

// GET /api/exchanges - List user's connected exchanges
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const supported = searchParams.get("supported");

    if (supported === "true") {
      return NextResponse.json({ exchanges: SUPPORTED_EXCHANGES });
    }

    // Fetch user's connected exchanges from database
    const connections = await db.exchangeConnections.findByUserId(authUser.dbUser.id);

    // Don't return encrypted keys
    const safeConnections = connections.map((conn) => ({
      id: conn.id,
      exchange: conn.exchange,
      name: conn.name,
      status: conn.status,
      lastUsedAt: conn.lastUsedAt,
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({ connections: safeConnections });
  } catch (error) {
    console.error("Get exchanges error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/exchanges - Connect new exchange
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { exchange, apiKey, apiSecret, passphrase, name } = body;

    if (!exchange || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate exchange is supported
    const exchangeInfo = SUPPORTED_EXCHANGES.find((e) => e.id === exchange);
    if (!exchangeInfo) {
      return NextResponse.json(
        { error: "Unsupported exchange" },
        { status: 400 }
      );
    }

    // Validate passphrase for exchanges that require it (Coinbase, KuCoin, OKX)
    if (EXCHANGES_REQUIRING_PASSPHRASE.includes(exchange) && !passphrase) {
      return NextResponse.json(
        { error: `${exchangeInfo.name} requires a passphrase for API authentication` },
        { status: 400 }
      );
    }

    // Encrypt API keys
    const encryptedApiKey = encryptApiKey(apiKey);
    const encryptedApiSecret = encryptApiKey(apiSecret);
    const encryptedPassphrase = passphrase ? encryptApiKey(passphrase) : undefined;

    // Create connection in database
    const connection = await db.exchangeConnections.create({
      userId: authUser.dbUser.id,
      exchange,
      name: name || exchangeInfo.name,
      encryptedApiKey,
      encryptedApiSecret,
      encryptedPassphrase,
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connection: {
        id: connection.id,
        exchange: connection.exchange,
        name: connection.name,
        status: connection.status,
        createdAt: connection.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create exchange connection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/exchanges - Proxy test connection to Neon API
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    const action = body?.action as string | undefined;

    if (!id || action !== "test") {
      return NextResponse.json(
        { error: "Unsupported action" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEURAL_TRADING_API_URL || "http://localhost:3001";
    const res = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/exchanges/${encodeURIComponent(id)}/test`,
      {
        method: "POST",
        cache: "no-store",
      },
    );

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error("Test exchange connection proxy error:", error);
    return NextResponse.json(
      { error: "Failed to test exchange connection" },
      { status: 500 }
    );
  }
}

// DELETE /api/exchanges - Delete exchange connection
export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing connection ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await db.exchangeConnections.findById(id);
    if (!connection || connection.userId !== authUser.dbUser.id) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    await db.exchangeConnections.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete exchange connection error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
