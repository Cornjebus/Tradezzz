import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";

// GET /api/orders - List user's orders
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const mode = searchParams.get("mode") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");

    // Fetch user's orders from database
    const orders = await db.orders.findByUserId(authUser.dbUser.id, {
      status,
      mode,
      limit,
    });

    return NextResponse.json({
      orders,
      total: orders.length,
      limit,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      symbol,
      side,
      type,
      quantity,
      price,
      stopPrice,
      strategyId,
      exchangeConnectionId,
      mode = "paper",
    } = body;

    if (!symbol || !side || !type || !quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate side
    if (!["buy", "sell"].includes(side)) {
      return NextResponse.json(
        { error: "Invalid side. Must be 'buy' or 'sell'" },
        { status: 400 }
      );
    }

    // Validate type
    if (!["market", "limit", "stop_loss", "take_profit"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid order type" },
        { status: 400 }
      );
    }

    // Validate mode
    if (!["paper", "live"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'paper' or 'live'" },
        { status: 400 }
      );
    }

    // Create order in database
    const order = await db.orders.create({
      userId: authUser.dbUser.id,
      symbol,
      side,
      type,
      quantity,
      price,
      stopPrice,
      strategyId,
      exchangeConnectionId,
      mode,
    });

    if (!order) {
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/orders - Update order (e.g., cancel)
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing order ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingOrder = await db.orders.findById(id);
    if (!existingOrder || existingOrder.user_id !== authUser.dbUser.id) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Update order
    const order = await db.orders.update(id, { status });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
