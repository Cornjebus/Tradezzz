"use client";

import { useEffect, useState } from "react";
import { Plus, Bot, Trash2, RefreshCw, CheckCircle2, XCircle, Zap, AlertTriangle } from "lucide-react";
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

const SUPPORTED_PROVIDERS = [
  { id: "openai", name: "OpenAI", logo: "🤖", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "anthropic", name: "Anthropic", logo: "🧠", models: ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"] },
  { id: "deepseek", name: "DeepSeek", logo: "🔮", models: ["deepseek-chat", "deepseek-coder"] },
  { id: "google", name: "Google AI", logo: "🌐", models: ["gemini-pro", "gemini-1.5-pro"] },
  { id: "cohere", name: "Cohere", logo: "💫", models: ["command-r-plus", "command-r"] },
  { id: "mistral", name: "Mistral", logo: "🌪️", models: ["mistral-large", "mistral-medium"] },
];

interface ProviderConnection {
  id: string;
  provider: string;
  name: string;
  model: string;
  is_active: boolean;
  created_at: string;
}

export default function AIProvidersPage() {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [providerName, setProviderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const selectedProviderData = SUPPORTED_PROVIDERS.find(p => p.id === selectedProvider);

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/ai-providers");
      if (res.ok) {
        const data = await res.json();
        setConnections(data.providers || []);
      }
    } catch (error) {
      console.error("Failed to fetch AI providers:", error);
      toast({
        title: "Error",
        description: "Failed to load AI providers",
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
    if (!selectedProvider || !apiKey || !selectedModel) return;

    setIsConnecting(true);

    try {
      const provider = SUPPORTED_PROVIDERS.find(p => p.id === selectedProvider);

      const res = await fetch("/api/ai-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          name: providerName || provider?.name,
          model: selectedModel,
          apiKey,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "AI provider connected successfully",
        });
        setIsAddDialogOpen(false);
        setSelectedProvider("");
        setSelectedModel("");
        setProviderName("");
        setApiKey("");
        fetchConnections();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to connect AI provider",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect AI provider",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connectionToDelete) return;

    try {
      const res = await fetch(`/api/ai-providers?id=${connectionToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "AI provider disconnected",
        });
        fetchConnections();
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to disconnect AI provider",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect AI provider",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const res = await fetch("/api/ai-providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "test" }),
      });

      if (res.ok) {
        toast({
          title: "Connection Test",
          description: "AI provider connection is working",
        });
        fetchConnections();
      } else {
        toast({
          title: "Connection Failed",
          description: "AI provider connection test failed",
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

  const getProviderInfo = (providerId: string) => {
    return SUPPORTED_PROVIDERS.find(p => p.id === providerId) || { name: providerId, logo: "🤖", models: [] };
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            AI Providers
            <span>🤖</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your AI providers for intelligent trading decisions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add AI Provider</DialogTitle>
                <DialogDescription>
                  Enter your AI provider API key. Your key is encrypted before storage.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={selectedProvider}
                    onValueChange={(value) => {
                      setSelectedProvider(value);
                      setSelectedModel("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <span className="flex items-center gap-2">
                            <span>{provider.logo}</span>
                            {provider.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProviderData && (
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProviderData.models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Display Name (optional)</Label>
                  <Input
                    placeholder="e.g., My Trading AI"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
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
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <div className="text-sm text-yellow-400">
                      <p className="font-medium">Usage Costs</p>
                      <p className="text-yellow-400/80">
                        AI usage is billed directly by the provider. Monitor your usage to control costs.
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleConnect}
                  disabled={!selectedProvider || !apiKey || !selectedModel || isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
            const provider = getProviderInfo(connection.provider);
            return (
              <Card key={connection.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{provider.logo}</div>
                      <div>
                        <h3 className="font-semibold">{connection.name || provider.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {connection.is_active ? (
                            <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          <Badge variant="outline">
                            {connection.model}
                          </Badge>
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
                        Test
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
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-medium mb-2">No AI providers connected</h3>
            <p className="text-muted-foreground mb-4">
              Add your AI provider to enable intelligent trading decisions
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Supported Providers */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Supported Providers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {SUPPORTED_PROVIDERS.map((provider) => (
            <Card key={provider.id} className="text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedProvider(provider.id);
                    setIsAddDialogOpen(true);
                  }}>
              <CardContent className="p-4">
                <div className="text-2xl mb-2">{provider.logo}</div>
                <p className="text-sm font-medium">{provider.name}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.models.length} models
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove AI Provider?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the AI provider and delete your API key from our servers.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-red-500 hover:bg-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
