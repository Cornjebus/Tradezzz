/**
 * Google Gemini Adapter - Real integration with Google AI Gemini API
 *
 * Supports: gemini-pro, gemini-1.5-pro (text-only usage here)
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

const GEMINI_MODELS = ['gemini-pro', 'gemini-1.5-pro'];

const MODEL_CAPABILITIES: Record<string, AdapterCapabilities> = {
  'gemini-pro': {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
  },
  'gemini-1.5-pro': {
    streaming: true,
    functionCalling: true,
    vision: true,
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
  },
};

export class GoogleAdapter implements AIAdapter {
  readonly name = 'Google Gemini';
  readonly provider = 'google';

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AIAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('Google Gemini API key is required');
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-pro';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.timeout = config.timeout || 30000;

    if (!GEMINI_MODELS.includes(this.model)) {
      throw new Error(`Unsupported model: ${this.model}. Supported: ${GEMINI_MODELS.join(', ')}`);
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        return {
          valid: false,
          models: [],
          error: error.error?.message || `HTTP ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const availableModels =
        data.models
          ?.map((m: any) => m.name?.split('/').pop())
          ?.filter((id: string) => GEMINI_MODELS.includes(id)) || GEMINI_MODELS;

      return {
        valid: true,
        models: availableModels,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        valid: false,
        models: [],
        error: error.message || 'Connection failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private buildContentsFromMessages(messages: ChatCompletionParams['messages']) {
    // Gemini uses a single array of contents with role + parts.
    // We'll map messages directly.
    return messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const startTime = Date.now();
    const model = params.model || this.model;

    const response = await fetch(
      `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.buildContentsFromMessages(params.messages),
          generationConfig: {
            temperature: params.temperature ?? 0.7,
            maxOutputTokens: params.maxTokens ?? 1000,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';

    const usage = data.usageMetadata || {};

    return {
      content: text,
      model,
      usage: {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
      },
      finishReason: data.candidates?.[0]?.finishReason || 'stop',
      latencyMs: Date.now() - startTime,
    };
  }

  async analyzeSentiment(params: SentimentParams): Promise<SentimentResult> {
    const systemPrompt = `You are a financial sentiment analyzer. Analyze the sentiment of the given text about cryptocurrency or stocks.

Respond with a JSON object containing:
- sentiment: "bullish", "bearish", or "neutral"
- score: number from -1 (very bearish) to 1 (very bullish)
- confidence: number from 0 to 1
- reasoning: short explanation

Only respond with valid JSON, no extra commentary.`;

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
      throw new Error('No JSON found in Gemini sentiment response');
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
}

Only respond with valid JSON, no additional commentary.`;

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
      throw new Error('No JSON found in Gemini signal response');
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

  getCapabilities(): AdapterCapabilities {
    return MODEL_CAPABILITIES[this.model] || MODEL_CAPABILITIES['gemini-pro'];
  }

  getSupportedModels(): string[] {
    return GEMINI_MODELS;
  }
}

