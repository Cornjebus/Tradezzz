/**
 * DeepSeek Adapter - Cost-efficient AI with OpenAI-compatible API
 *
 * Supports: deepseek-chat, deepseek-coder
 * Pricing: ~$0.0001/1K tokens (100x cheaper than GPT-4)
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

const DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-coder',
];

const MODEL_CAPABILITIES: Record<string, AdapterCapabilities> = {
  'deepseek-chat': {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 64000,
    maxOutputTokens: 4096,
  },
  'deepseek-coder': {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 64000,
    maxOutputTokens: 4096,
  },
};

export class DeepSeekAdapter implements AIAdapter {
  readonly name = 'DeepSeek';
  readonly provider = 'deepseek';

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AIAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('DeepSeek API key is required');
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'deepseek-chat';
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
    this.timeout = config.timeout || 30000;

    if (!DEEPSEEK_MODELS.includes(this.model)) {
      throw new Error(`Unsupported model: ${this.model}. Supported: ${DEEPSEEK_MODELS.join(', ')}`);
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      // DeepSeek uses OpenAI-compatible API
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        return {
          valid: false,
          models: [],
          error: error.error?.message || `HTTP ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        valid: true,
        models: DEEPSEEK_MODELS,
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

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const startTime = Date.now();
    const model = params.model || this.model;

    // DeepSeek uses OpenAI-compatible format
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1000,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
      latencyMs: Date.now() - startTime,
    };
  }

  async analyzeSentiment(params: SentimentParams): Promise<SentimentResult> {
    const systemPrompt = `You are a financial sentiment analyzer. Analyze the sentiment of the given text about cryptocurrency/stocks.

Respond with a JSON object containing:
- sentiment: "bullish", "bearish", or "neutral"
- score: number from -1 (very bearish) to 1 (very bullish)
- confidence: number from 0 to 1
- reasoning: brief explanation

Only respond with valid JSON, no other text.`;

    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze the sentiment of this text${params.symbol ? ` about ${params.symbol}` : ''}:\n\n"${params.text}"` },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment || 'neutral',
        score: Math.max(-1, Math.min(1, parsed.score || 0)),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'Unable to determine reasoning',
      };
    } catch (error) {
      const content = result.content.toLowerCase();
      let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let score = 0;

      if (content.includes('bullish') || content.includes('positive')) {
        sentiment = 'bullish';
        score = 0.5;
      } else if (content.includes('bearish') || content.includes('negative')) {
        sentiment = 'bearish';
        score = -0.5;
      }

      return {
        sentiment,
        score,
        confidence: 0.5,
        reasoning: result.content.slice(0, 200),
      };
    }
  }

  async generateSignal(params: TradingSignalParams): Promise<TradingSignalResult> {
    const systemPrompt = `You are an AI trading assistant. Based on the given market data, generate a trading signal.

Respond with a JSON object containing:
- action: "buy", "sell", or "hold"
- confidence: number from 0 to 1
- reasoning: brief explanation of the signal
- suggestedSize: number from 0 to 1 (percentage of available capital)
- stopLoss: suggested stop loss price (optional)
- takeProfit: suggested take profit price (optional)

Only respond with valid JSON, no other text.`;

    const userPrompt = `Symbol: ${params.symbol}
Current Price: ${params.price}
Technical Indicators:
${Object.entries(params.indicators).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
${params.context ? `\nAdditional Context: ${params.context}` : ''}

Generate a trading signal.`;

    const result = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 400,
    });

    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'hold',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedSize: Math.max(0, Math.min(1, parsed.suggestedSize || 0)),
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
      };
    } catch (error) {
      return {
        action: 'hold',
        confidence: 0,
        reasoning: `Failed to parse AI response: ${result.content.slice(0, 100)}`,
        suggestedSize: 0,
      };
    }
  }

  getCapabilities(): AdapterCapabilities {
    return MODEL_CAPABILITIES[this.model] || MODEL_CAPABILITIES['deepseek-chat'];
  }

  getSupportedModels(): string[] {
    return DEEPSEEK_MODELS;
  }
}
