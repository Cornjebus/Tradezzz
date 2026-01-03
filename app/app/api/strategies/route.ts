import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";

// GET /api/strategies - List user's strategies
export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's strategies from database
    const strategies = await db.strategies.findByUserId(authUser.dbUser.id);

    return NextResponse.json({ strategies });
  } catch (error) {
    console.error("Get strategies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/strategies - Create new strategy
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, description, config } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate strategy type
    const validTypes = ["momentum", "mean_reversion", "sentiment", "arbitrage", "trend_following", "custom"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid strategy type" },
        { status: 400 }
      );
    }

    // Create strategy in database
    const strategy = await db.strategies.create({
      userId: authUser.dbUser.id,
      name,
      type,
      description,
      config,
    });

    if (!strategy) {
      return NextResponse.json(
        { error: "Failed to create strategy" },
        { status: 500 }
      );
    }

    return NextResponse.json({ strategy }, { status: 201 });
  } catch (error) {
    console.error("Create strategy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/strategies - Delete strategy
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
        { error: "Missing strategy ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const strategy = await db.strategies.findById(id);
    if (!strategy || strategy.userId !== authUser.dbUser.id) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    await db.strategies.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete strategy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/strategies - Update strategy
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, status, config } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing strategy ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existingStrategy = await db.strategies.findById(id);
    if (!existingStrategy || existingStrategy.userId !== authUser.dbUser.id) {
      return NextResponse.json(
        { error: "Strategy not found" },
        { status: 404 }
      );
    }

    // Update strategy
    const strategy = await db.strategies.update(id, {
      name,
      description,
      status,
      config,
    });

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error("Update strategy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
