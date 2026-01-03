import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";

/**
 * GET /api/user/settings - Get user settings
 */
export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await db.userSettings.findByUserId(authUser.dbUser.id);

    return NextResponse.json({
      settings: settings || {
        timezone: "UTC",
        riskLevel: "medium",
        currency: "USD",
        graphRiskMode: "warn",
        notifications: {
          email: true,
          trades: true,
          alerts: true,
          marketing: false,
        },
      },
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/user/settings - Update user settings
 */
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    // Accept both camelCase and snake_case for backwards compatibility
    const timezone = body.timezone;
    const riskLevel = body.riskLevel || body.risk_level;
    const currency = body.currency;
    const graphRiskMode = body.graphRiskMode || body.graph_risk_mode;
    const notifications = body.notifications;

    // Build update object with camelCase property names
    const updateData: Record<string, unknown> = {};
    if (timezone !== undefined) updateData.timezone = timezone;
    if (riskLevel !== undefined) updateData.riskLevel = riskLevel;
    if (currency !== undefined) updateData.currency = currency;
    if (graphRiskMode !== undefined) updateData.graphRiskMode = graphRiskMode;
    if (notifications !== undefined) updateData.notifications = JSON.stringify(notifications);

    await db.userSettings.upsert(authUser.dbUser.id, updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
