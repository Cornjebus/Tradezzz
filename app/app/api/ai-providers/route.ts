import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import db from "@/lib/db";
import { encryptApiKey } from "@/lib/encryption";

const SUPPORTED_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"] },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-coder"] },
  { id: "google", name: "Google AI", models: ["gemini-pro", "gemini-1.5-pro"] },
  { id: "cohere", name: "Cohere", models: ["command-r-plus", "command-r"] },
  { id: "mistral", name: "Mistral", models: ["mistral-large", "mistral-medium"] },
];

// GET /api/ai-providers - List user's connected AI providers
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const supported = searchParams.get("supported");

    if (supported === "true") {
      return NextResponse.json({ providers: SUPPORTED_PROVIDERS });
    }

    // Fetch user's connected providers from database
    const providers = await db.aiProviders.findByUserId(authUser.dbUser.id);

    // Don't return encrypted keys
    const safeProviders = providers.map((provider) => ({
      id: provider.id,
      provider: provider.provider,
      name: provider.name,
      status: provider.status,
      defaultModel: provider.defaultModel,
      totalTokensUsed: provider.totalTokensUsed,
      totalRequests: provider.totalRequests,
      lastUsedAt: provider.lastUsedAt,
      createdAt: provider.createdAt,
    }));

    return NextResponse.json({ providers: safeProviders });
  } catch (error) {
    console.error("Get AI providers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/ai-providers - Add new AI provider
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { provider, model, apiKey, name } = body;

    if (!provider || !model || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate provider is supported
    const providerInfo = SUPPORTED_PROVIDERS.find((p) => p.id === provider);
    if (!providerInfo) {
      return NextResponse.json(
        { error: "Unsupported provider" },
        { status: 400 }
      );
    }

    // Validate model is supported
    if (!providerInfo.models.includes(model)) {
      return NextResponse.json(
        { error: "Unsupported model for this provider" },
        { status: 400 }
      );
    }

    // Encrypt API key
    const encryptedApiKey = encryptApiKey(apiKey);

    // Create provider in database
    const newProvider = await db.aiProviders.create({
      userId: authUser.dbUser.id,
      provider,
      name: name || providerInfo.name,
      encryptedApiKey,
      defaultModel: model,
    });

    if (!newProvider) {
      return NextResponse.json(
        { error: "Failed to create provider" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      provider: {
        id: newProvider.id,
        provider: newProvider.provider,
        name: newProvider.name,
        status: newProvider.status,
        defaultModel: newProvider.defaultModel,
        createdAt: newProvider.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Create AI provider error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/ai-providers - Proxy test connection to Neon API
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    const action = body?.action as string | undefined;

    if (!id || action !== "test") {
      return NextResponse.json(
        { error: "Unsupported action" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEURAL_TRADING_API_URL || "http://localhost:3001";
    const res = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/ai/providers/${encodeURIComponent(id)}/test`,
      {
        method: "POST",
        cache: "no-store",
      },
    );

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error("Test AI provider proxy error:", error);
    return NextResponse.json(
      { error: "Failed to test AI provider" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai-providers - Delete AI provider
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
        { error: "Missing provider ID" },
        { status: 400 }
      );
    }

    // Verify ownership
    const provider = await db.aiProviders.findById(id);
    if (!provider || provider.userId !== authUser.dbUser.id) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    await db.aiProviders.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete AI provider error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
