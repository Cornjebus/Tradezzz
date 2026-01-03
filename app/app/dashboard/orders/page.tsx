"use client";

import { useEffect, useState } from "react";
import { Filter, Download, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop_loss" | "take_profit";
  quantity: number;
  price: number;
  status: "filled" | "pending" | "cancelled" | "rejected";
  mode: "paper" | "live";
  createdAt: string;
  filledAt?: string;
}

interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  timestamp: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    filled: 0,
    winRate: 0,
    totalPnL: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch orders from database
      const ordersRes = await fetch("/api/orders");
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }

      // Fetch trades from paper trading engine
      const tradesRes = await fetch("/api/trading?action=trades");
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades || []);
      }

      // Calculate stats
      const allOrders = orders;
      const filledOrders = allOrders.filter(o => o.status === "filled");
      setStats({
        total: allOrders.length,
        filled: filledOrders.length,
        winRate: 0, // Would need PnL data to calculate
        totalPnL: 0,
      });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Combine database orders and paper trading trades
  const allActivity = [
    ...orders.map(o => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      quantity: o.quantity,
      price: o.price || 0,
      status: o.status,
      timestamp: o.createdAt,
      source: "database" as const,
    })),
    ...trades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      type: "market" as const,
      quantity: t.quantity,
      price: t.price,
      status: "filled" as const,
      timestamp: t.timestamp,
      source: "paper" as const,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredActivity = allActivity.filter(item => {
    if (activeTab === "all") return true;
    if (activeTab === "open") return item.status === "pending";
    if (activeTab === "filled") return item.status === "filled";
    if (activeTab === "cancelled") return item.status === "cancelled" || item.status === "rejected";
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "filled": return "bg-green-500/20 text-green-400";
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "cancelled": return "bg-red-500/20 text-red-400";
      case "rejected": return "bg-red-500/20 text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Order History
            <span>📜</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all your trades and orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList>
          <TabsTrigger value="all" onClick={() => setActiveTab("all")}>
            All Orders ({allActivity.length})
          </TabsTrigger>
          <TabsTrigger value="open" onClick={() => setActiveTab("open")}>
            Open ({allActivity.filter(o => o.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="filled" onClick={() => setActiveTab("filled")}>
            Filled ({allActivity.filter(o => o.status === "filled").length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" onClick={() => setActiveTab("cancelled")}>
            Cancelled
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders Table */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-20 bg-muted animate-pulse rounded" />
                  <div className="flex-1 h-10 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredActivity.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivity.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.symbol}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={item.side === "buy" ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}
                    >
                      {item.side === "buy" ? (
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 mr-1" />
                      )}
                      {item.side.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{item.type.replace("_", " ")}</TableCell>
                  <TableCell>{item.quantity.toLocaleString()}</TableCell>
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-muted-foreground">
                      {item.source === "paper" ? "Paper" : "DB"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium mb-2">No orders yet</h3>
            <p className="text-muted-foreground">
              Your trading history will appear here once you start trading
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{allActivity.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Filled</p>
            <p className="text-2xl font-bold text-green-400">
              {allActivity.filter(o => o.status === "filled").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Paper Trades</p>
            <p className="text-2xl font-bold text-yellow-400">
              {trades.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-blue-400">
              {allActivity.filter(o => o.status === "pending").length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
