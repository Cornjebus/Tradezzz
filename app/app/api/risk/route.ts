import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { riskManager, RISK_PROFILES, RiskProfileType } from "@/lib/risk-manager";
import { paperTradingEngine } from "@/lib/trading";

// GET /api/risk - Get risk metrics and profile
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    const userId = authUser.dbUser.id;

    switch (action) {
      case "profile":
        // Get user's risk profile and limits
        const profile = riskManager.getUserProfile(userId);
        return NextResponse.json({
          limits: profile.limits,
          dailyStats: profile.dailyStats,
          historicalMetrics: profile.historicalMetrics,
        });

      case "warnings":
        // Get recent risk warnings
        const limit = parseInt(searchParams.get("limit") || "10");
        const warnings = riskManager.getWarnings(userId, limit);
        return NextResponse.json({ warnings });

      case "presets":
        // Get available risk presets
        return NextResponse.json({
          presets: Object.keys(RISK_PROFILES).map((key) => ({
            name: key,
            limits: RISK_PROFILES[key as RiskProfileType],
          })),
        });

      default:
        // Get current risk metrics
        const portfolioValue = paperTradingEngine.getPortfolioValue(userId);
        const positions = paperTradingEngine.getPositions(userId);
        const metrics = riskManager.getMetrics(
          userId,
          portfolioValue,
          positions.length
        );

        return NextResponse.json({ metrics });
    }
  } catch (error) {
    console.error("Get risk error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/risk - Risk actions (update limits, check position, etc.)
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;
    const userId = authUser.dbUser.id;

    switch (action) {
      case "update-limits": {
        // Update risk limits
        const {
          maxPositionSize,
          maxDailyLoss,
          maxOpenPositions,
          maxLeverage,
          stopLossRequired,
          takeProfitRecommended,
          maxDrawdown,
        } = data;

        const limits = riskManager.updateLimits(userId, {
          maxPositionSize,
          maxDailyLoss,
          maxOpenPositions,
          maxLeverage,
          stopLossRequired,
          takeProfitRecommended,
          maxDrawdown,
        });

        return NextResponse.json({ success: true, limits });
      }

      case "apply-preset": {
        // Apply a preset risk profile
        const { preset } = data;

        if (!preset || !Object.keys(RISK_PROFILES).includes(preset)) {
          return NextResponse.json(
            { error: "Invalid preset. Must be: conservative, moderate, or aggressive" },
            { status: 400 }
          );
        }

        const limits = riskManager.applyPreset(userId, preset as RiskProfileType);
        return NextResponse.json({ success: true, preset, limits });
      }

      case "check-position": {
        // Check if a position is allowed
        const { positionValue, portfolioValue, currentOpenPositions, leverage } = data;

        if (positionValue === undefined || portfolioValue === undefined) {
          return NextResponse.json(
            { error: "Missing positionValue or portfolioValue" },
            { status: 400 }
          );
        }

        // Get actual values if not provided
        const actualPortfolioValue =
          portfolioValue || paperTradingEngine.getPortfolioValue(userId);
        const actualOpenPositions =
          currentOpenPositions ?? paperTradingEngine.getPositions(userId).length;

        const check = riskManager.checkPosition(
          userId,
          positionValue,
          actualPortfolioValue,
          actualOpenPositions,
          leverage
        );

        return NextResponse.json(check);
      }

      case "calculate-size": {
        // Calculate optimal position size
        const { entryPrice, stopLoss, riskPerTrade } = data;

        if (!entryPrice) {
          return NextResponse.json(
            { error: "Missing entryPrice" },
            { status: 400 }
          );
        }

        const portfolioValue = paperTradingEngine.getPortfolioValue(userId);
        const sizing = riskManager.calculatePositionSize(
          userId,
          portfolioValue,
          entryPrice,
          stopLoss,
          riskPerTrade
        );

        return NextResponse.json({
          ...sizing,
          portfolioValue,
          entryPrice,
          stopLoss: stopLoss || null,
        });
      }

      case "record-trade": {
        // Record a completed trade for risk tracking
        const { pnl, currentBalance } = data;

        if (pnl === undefined) {
          return NextResponse.json(
            { error: "Missing pnl" },
            { status: 400 }
          );
        }

        const balance =
          currentBalance || paperTradingEngine.getPortfolioValue(userId);
        const metrics = riskManager.recordTrade(userId, pnl, balance);

        return NextResponse.json({ success: true, metrics });
      }

      case "reset-daily": {
        // Reset daily stats
        const currentBalance = paperTradingEngine.getPortfolioValue(userId);
        riskManager.resetDailyStats(userId, currentBalance);

        return NextResponse.json({
          success: true,
          message: "Daily stats reset",
        });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Risk action error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
