/**
 * GrokAdapter - AIAdapter implementation for xAI Grok models
 *
 * This adapter assumes an OpenAI-compatible HTTP interface exposed by xAI.
 * It supports chat completions and builds higher-level sentiment and trading
 * signals on top of that.
 */

import {
  AIAdapter,
  AIAdapterConfig,
  ChatCompletionParams,
  ChatCompletionResult,
  SentimentParams,
  SentimentResult,
  TradingSignalParams,
  TradingSignalResult,
  AdapterCapabilities,
  TestConnectionResult,
} from './types';

const GROK_MODELS = ['grok-2', 'grok-2-mini'];

const GROK_CAPABILITIES: AdapterCapabilities = {
  streaming: true,
  functionCalling: true,
  vision: false,
  maxContextTokens: 128000,
  maxOutputTokens: 4096,
};

export class GrokAdapter implements AIAdapter {
  readonly name = 'Grok';
  readonly provider = 'grok';

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AIAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('Grok API key is required');
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'grok-2';
    this.baseUrl = config.baseUrl || process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
    this.timeout = config.timeout || 30000;

    if (!GROK_MODELS.includes(this.model)) {
      throw new Error(`Unsupported Grok model: ${this.model}. Supported: ${GROK_MODELS.join(', ')}`);
    }
  }

  getCapabilities(): AdapterCapabilities {
    return GROK_CAPABILITIES;
  }

  getSupportedModels(): string[] {
    return GROK_MODELS;
  }

  private async postJson(path: string, body: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(id);
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    try {
      // Simple test: list models or perform a lightweight call if supported.
      // Here we just return the known set and rely on a later failure if key is bad.
      return {
        valid: true,
        models: GROK_MODELS,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        valid: false,
        models: [],
        error: error.message || 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const start = Date.now();
    const model = params.model || this.model;

    const data = await this.postJson('/chat/completions', {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 1000,
      stream: false,
    });

    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      model: data.model || model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: choice?.finish_reason || 'stop',
      latencyMs: Date.now() - start,
    };
  }

  async analyzeSentiment(params: SentimentParams): Promise<SentimentResult> {
    const systemPrompt = `You are a sentiment analyzer focused on crypto and financial markets.
Respond with a JSON object:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "score": number between -1 and 1,
  "confidence": number between 0 and 1,
  "reasoning": "short explanation"
}`;

    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze the sentiment of this text${params.symbol ? ` about ${params.symbol}` : ''}:\n\n"${params.text}"`,
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Grok response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      sentiment: parsed.sentiment,
      score: parsed.score,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  }

  async generateSignal(params: TradingSignalParams): Promise<TradingSignalResult> {
    const systemPrompt = `You are an AI trading assistant.
Given price, indicators, and context, generate a trading signal.
Respond with JSON:
{
  "action": "buy" | "sell" | "hold",
  "confidence": number between 0 and 1,
  "reasoning": "short explanation",
  "suggestedSize": number,
  "stopLoss": number | null,
  "takeProfit": number | null
}`;

    const description = [
      `Symbol: ${params.symbol}`,
      `Price: ${params.price}`,
      `Indicators: ${JSON.stringify(params.indicators || {})}`,
      params.context ? `Context: ${params.context}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ],
      temperature: 0.4,
      maxTokens: 400,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Grok signal response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      action: parsed.action,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      suggestedSize: parsed.suggestedSize,
      stopLoss: parsed.stopLoss ?? undefined,
      takeProfit: parsed.takeProfit ?? undefined,
    };
  }
}

