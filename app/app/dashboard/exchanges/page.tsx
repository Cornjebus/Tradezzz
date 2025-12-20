"use client";

import { useEffect, useState } from "react";
import { Plus, Link2, Trash2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const SUPPORTED_EXCHANGES = [
  { id: "binance", name: "Binance", logo: "🟡" },
  { id: "coinbase", name: "Coinbase", logo: "🔵" },
  { id: "kraken", name: "Kraken", logo: "🟣" },
  { id: "kucoin", name: "KuCoin", logo: "🟢" },
  { id: "bybit", name: "Bybit", logo: "🟠" },
  { id: "okx", name: "OKX", logo: "⚪" },
];

interface ExchangeConnection {
  id: string;
  exchange: string;
  name: string;
  status: string;
  is_active: boolean;
  created_at: string;
}

export default function ExchangesPage() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/exchanges");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error("Failed to fetch exchanges:", error);
      toast({
        title: "Error",
        description: "Failed to load exchange connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleConnect = async () => {
    if (!selectedExchange || !apiKey || !apiSecret) return;

    setIsConnecting(true);

    try {
      const exchange = SUPPORTED_EXCHANGES.find(e => e.id === selectedExchange);

      const res = await fetch("/api/exchanges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchange: selectedExchange,
          name: connectionName || exchange?.name,
          apiKey,
          apiSecret,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Exchange connected successfully",
        });
        setIsAddDialogOpen(false);
        setSelectedExchange("");
        setConnectionName("");
        setApiKey("");
        setApiSecret("");
        fetchConnections();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to connect exchange",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect exchange",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectionToDelete) return;

    try {
      const res = await fetch(`/api/exchanges?id=${connectionToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Exchange disconnected",
        });
        fetchConnections();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to disconnect exchange",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect exchange",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const res = await fetch("/api/exchanges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "test" }),
      });

      if (res.ok) {
        toast({
          title: "Connection Test",
          description: "Exchange connection is working",
        });
        fetchConnections();
      } else {
        toast({
          title: "Connection Failed",
          description: "Exchange connection test failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive",
      });
    }
  };

  const getExchangeInfo = (exchangeId: string) => {
    return SUPPORTED_EXCHANGES.find(e => e.id === exchangeId) || { name: exchangeId, logo: "🔗" };
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Exchanges
            <span>🔗</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your exchange accounts to start trading
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Connect Exchange
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Exchange</DialogTitle>
              <DialogDescription>
                Enter your exchange API credentials. Your keys are encrypted before storage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Exchange</Label>
                <Select value={selectedExchange} onValueChange={setSelectedExchange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an exchange" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_EXCHANGES.map((exchange) => (
                      <SelectItem key={exchange.id} value={exchange.id}>
                        <span className="flex items-center gap-2">
                          <span>{exchange.logo}</span>
                          {exchange.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Connection Name (optional)</Label>
                <Input
                  placeholder="e.g., My Trading Account"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Secret</Label>
                <Input
                  type="password"
                  placeholder="Enter your API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-400">
                    <p className="font-medium">Security Note</p>
                    <p className="text-yellow-400/80">
                      Only enable trading permissions. Never enable withdrawal permissions for API keys.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={!selectedExchange || !apiKey || !apiSecret || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted animate-pulse rounded" />
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length > 0 ? (
        <div className="grid gap-4">
          {connections.map((connection) => {
            const exchange = getExchangeInfo(connection.exchange);
            return (
              <Card key={connection.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{exchange.logo}</div>
                      <div>
                        <h3 className="font-semibold">{connection.name || exchange.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {connection.is_active ? (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            Added {new Date(connection.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(connection.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          setConnectionToDelete(connection.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-lg font-medium mb-2">No exchanges connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your first exchange to start paper trading
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Exchange
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Supported Exchanges */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Supported Exchanges</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {SUPPORTED_EXCHANGES.map((exchange) => (
            <Card key={exchange.id} className="text-center">
              <CardContent className="p-4">
                <div className="text-2xl mb-2">{exchange.logo}</div>
                <p className="text-sm font-medium">{exchange.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Exchange?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the exchange connection and delete your API credentials.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-500 hover:bg-red-600"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
