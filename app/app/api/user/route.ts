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
      isActive: authUser.dbUser.isActive,
      settings: authUser.settings || {
        timezone: "UTC",
        notificationsEnabled: true,
        emailAlerts: true,
        riskLevel: "medium",
      },
      createdAt: authUser.dbUser.createdAt,
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

export async function DELETE() {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all user data in order (respecting foreign keys)
    // 1. Delete user settings
    await db.userSettings.deleteByUserId(authUser.dbUser.id);

    // 2. Delete exchange connections
    const connections = await db.exchangeConnections.findByUserId(authUser.dbUser.id);
    for (const conn of connections) {
      await db.exchangeConnections.delete(conn.id);
    }

    // 3. Delete AI providers
    const providers = await db.aiProviders.findByUserId(authUser.dbUser.id);
    for (const provider of providers) {
      await db.aiProviders.delete(provider.id);
    }

    // 4. Delete strategies
    const strategies = await db.strategies.findByUserId(authUser.dbUser.id);
    for (const strategy of strategies) {
      await db.strategies.delete(strategy.id);
    }

    // 5. Finally, deactivate the user (soft delete)
    await db.users.update(authUser.dbUser.id, { isActive: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
