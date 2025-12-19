import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { tradingService } from "@/lib/exchanges";

/**
 * Trading API
 *
 * IMPORTANT: User must connect an exchange before trading.
 * All prices come from the user's connected exchange.
 */

// GET /api/trading - Get trading status, prices, balances, etc.
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.dbUser.id;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    // Get current state (always available)
    const state = tradingService.getState(userId);

    // Actions that require exchange connection
    const requiresExchange = [
      "balances", "orders", "open-orders", "trades", "positions",
      "portfolio", "prices", "price", "symbols", "ticker"
    ];

    if (requiresExchange.includes(action || "") && !state.canTrade) {
      return NextResponse.json({
        error: "Connect an exchange first",
        requiresExchange: true,
        state,
      }, { status: 400 });
    }

    switch (action) {
      case "balances":
        return NextResponse.json({
          balances: await tradingService.getBalances(userId),
        });

      case "orders":
        return NextResponse.json({
          orders: await tradingService.getOrderHistory(userId),
        });

      case "open-orders":
        return NextResponse.json({
          orders: await tradingService.getOpenOrders(userId),
        });

      case "trades":
        return NextResponse.json({
          trades: await tradingService.getTrades(userId),
        });

      case "positions":
        return NextResponse.json({
          positions: await tradingService.getPositions(userId),
        });

      case "portfolio":
        return NextResponse.json({
          value: await tradingService.getPortfolioValue(userId),
        });

      case "prices": {
        const symbolsParam = searchParams.get("symbols");
        const symbols = symbolsParam ? symbolsParam.split(",") : undefined;
        return NextResponse.json({
          prices: await tradingService.getTickers(userId, symbols),
        });
      }

      case "ticker": {
        const symbol = searchParams.get("symbol");
        if (!symbol) {
          return NextResponse.json({ error: "Symbol required" }, { status: 400 });
        }
        return NextResponse.json({
          ticker: await tradingService.getTicker(userId, symbol),
        });
      }

      case "symbols":
        return NextResponse.json({
          symbols: await tradingService.getTradingPairs(userId),
        });

      default:
        // Return trading state
        return NextResponse.json(state);
    }
  } catch (error) {
    console.error("Get trading error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/trading - Trading actions
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.dbUser.id;
    const body = await request.json();
    const { action, ...data } = body;

    // Check if exchange is connected for trading actions
    const state = tradingService.getState(userId);
    const requiresExchange = ["create-order", "cancel-order", "switch-mode", "reset-paper"];

    if (requiresExchange.includes(action) && !state.canTrade && action !== "connect") {
      return NextResponse.json({
        error: "Connect an exchange first",
        requiresExchange: true,
        state,
      }, { status: 400 });
    }

    switch (action) {
      case "connect": {
        // Connect to an exchange
        const { exchangeConnectionId } = data;
        if (!exchangeConnectionId) {
          return NextResponse.json(
            { error: "Exchange connection ID required" },
            { status: 400 }
          );
        }

        try {
          const newState = await tradingService.connectExchange(userId, exchangeConnectionId);
          return NextResponse.json({
            success: true,
            message: `Connected to ${newState.exchangeName}`,
            state: newState,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to connect";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }

      case "disconnect": {
        tradingService.disconnectExchange(userId);
        return NextResponse.json({
          success: true,
          state: tradingService.getState(userId),
        });
      }

      case "switch-mode": {
        const { mode, acknowledged } = data;
        if (!mode || !["paper", "live"].includes(mode)) {
          return NextResponse.json(
            { error: "Invalid mode. Must be 'paper' or 'live'" },
            { status: 400 }
          );
        }

        try {
          const newState = await tradingService.switchMode(userId, mode, { acknowledged });
          return NextResponse.json({
            success: true,
            state: newState,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to switch mode";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }

      case "create-order": {
        const { symbol, side, type = "market", quantity, price } = data;

        if (!symbol || !side || !quantity) {
          return NextResponse.json(
            { error: "Missing required fields: symbol, side, quantity" },
            { status: 400 }
          );
        }

        if (!["buy", "sell"].includes(side)) {
          return NextResponse.json(
            { error: "Side must be 'buy' or 'sell'" },
            { status: 400 }
          );
        }

        try {
          const order = await tradingService.createOrder(userId, {
            symbol,
            side,
            type,
            quantity: parseFloat(quantity),
            price: price ? parseFloat(price) : undefined,
          });

          return NextResponse.json({
            success: true,
            order,
            mode: state.mode,
          }, { status: 201 });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to create order";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }

      case "cancel-order": {
        const { orderId, symbol } = data;
        if (!orderId) {
          return NextResponse.json(
            { error: "Missing order ID" },
            { status: 400 }
          );
        }

        const success = await tradingService.cancelOrder(userId, orderId, symbol);
        if (!success) {
          return NextResponse.json(
            { error: "Order not found or cannot be cancelled" },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true });
      }

      case "reset-paper": {
        tradingService.resetPaperAccount(userId);
        return NextResponse.json({
          success: true,
          message: "Paper trading account reset to $100,000",
          balances: await tradingService.getBalances(userId),
        });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Trading action error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
