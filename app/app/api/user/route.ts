import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();

    return NextResponse.json({
      id: authUser.dbUser.id,
      clerkId: authUser.clerkId,
      email: authUser.email,
      firstName: clerkUser?.firstName,
      lastName: clerkUser?.lastName,
      imageUrl: clerkUser?.imageUrl,
      tier: authUser.dbUser.tier,
      isActive: authUser.dbUser.is_active,
      settings: authUser.settings || {
        timezone: "UTC",
        notifications_enabled: true,
        email_alerts: true,
        risk_level: "medium",
      },
      createdAt: authUser.dbUser.created_at,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settings } = body;

    if (settings) {
      await db.userSettings.upsert(authUser.dbUser.id, settings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
