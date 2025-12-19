"use client";

import { useEffect, useState } from "react";
import { Plus, LineChart, Play, Pause, Trash2, Copy, Settings, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const STRATEGY_TYPES = [
  { id: "momentum", name: "Momentum", description: "Follow the trend" },
  { id: "mean_reversion", name: "Mean Reversion", description: "Buy low, sell high" },
  { id: "sentiment", name: "Sentiment", description: "AI-powered market sentiment" },
  { id: "arbitrage", name: "Arbitrage", description: "Cross-exchange opportunities" },
  { id: "trend_following", name: "Trend Following", description: "Long-term trends" },
  { id: "custom", name: "Custom", description: "Build your own strategy" },
];

interface Strategy {
  id: string;
  name: string;
  type: string;
  description?: string;
  status: string;
  config?: Record<string, unknown>;
  created_at: string;
}

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<string | null>(null);
  const [strategyName, setStrategyName] = useState("");
  const [strategyType, setStrategyType] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const fetchStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies || []);
      }
    } catch (error) {
      console.error("Failed to fetch strategies:", error);
      toast({
        title: "Error",
        description: "Failed to load strategies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleCreate = async () => {
    if (!strategyName || !strategyType) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: strategyName,
          type: strategyType,
          description: strategyDescription,
          config: {},
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Strategy created successfully",
        });
        setIsCreateDialogOpen(false);
        setStrategyName("");
        setStrategyType("");
        setStrategyDescription("");
        fetchStrategies();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create strategy",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create strategy",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!strategyToDelete) return;

    try {
      const res = await fetch(`/api/strategies?id=${strategyToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Strategy deleted",
        });
        fetchStrategies();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete strategy",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete strategy",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setStrategyToDelete(null);
    }
  };

  const handleStatusToggle = async (strategy: Strategy) => {
    const newStatus = strategy.status === "active" ? "paused" : "active";
    try {
      const res = await fetch("/api/strategies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: strategy.id,
          status: newStatus,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Strategy ${newStatus === "active" ? "started" : "paused"}`,
        });
        fetchStrategies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-400";
      case "paper": return "bg-yellow-500/20 text-yellow-400";
      case "paused": return "bg-orange-500/20 text-orange-400";
      case "backtesting": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeInfo = (typeId: string) => {
    return STRATEGY_TYPES.find(t => t.id === typeId) || { name: typeId, description: "" };
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Trading Strategies
            <span>📈</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your AI-powered trading strategies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchStrategies} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Strategy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Strategy</DialogTitle>
                <DialogDescription>
                  Set up a new AI-powered trading strategy
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Strategy Name</Label>
                  <Input
                    placeholder="My Trading Strategy"
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Strategy Type</Label>
                  <Select value={strategyType} onValueChange={setStrategyType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGY_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div>
                            <div className="font-medium">{type.name}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    placeholder="Describe your strategy..."
                    value={strategyDescription}
                    onChange={(e) => setStrategyDescription(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!strategyName || !strategyType || isCreating}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <LineChart className="h-4 w-4 mr-2" />
                      Create Strategy
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Strategies List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted animate-pulse rounded" />
                  <div className="flex-1">
                    <div className="h-5 w-40 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : strategies.length > 0 ? (
        <div className="grid gap-4">
          {strategies.map((strategy) => {
            const type = getTypeInfo(strategy.type);
            return (
              <Card key={strategy.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-indigo-500/20">
                        <LineChart className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{strategy.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(strategy.status)}>
                            {strategy.status}
                          </Badge>
                          <Badge variant="outline">{type.name}</Badge>
                          {strategy.description && (
                            <span className="text-sm text-muted-foreground">
                              {strategy.description}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(strategy.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusToggle(strategy)}
                      >
                        {strategy.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          setStrategyToDelete(strategy.id);
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
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-medium mb-2">No strategies yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI-powered trading strategy
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Create Your First Strategy
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Strategy Types */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Strategy Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STRATEGY_TYPES.map((type) => (
            <Card key={type.id}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{type.name}</h3>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this strategy and all its configuration.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
