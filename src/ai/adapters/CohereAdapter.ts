/**
 * Cohere Adapter - Enterprise-grade AI with Command models
 *
 * Supports: command-r-plus, command-r, command
 * Features: Chat, RAG, embeddings, reranking
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

const COHERE_MODELS = [
  'command-r-plus',
  'command-r',
  'command',
  'command-light',
];

const MODEL_CAPABILITIES: Record<string, AdapterCapabilities> = {
  'command-r-plus': {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
  },
  'command-r': {
    streaming: true,
    functionCalling: true,
    vision: false,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
  },
  'command': {
    streaming: true,
    functionCalling: false,
    vision: false,
    maxContextTokens: 4096,
    maxOutputTokens: 4096,
  },
  'command-light': {
    streaming: true,
    functionCalling: false,
    vision: false,
    maxContextTokens: 4096,
    maxOutputTokens: 4096,
  },
};

export class CohereAdapter implements AIAdapter {
  readonly name = 'Cohere';
  readonly provider = 'cohere';

  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AIAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('Cohere API key is required');
    }

    this.apiKey = config.apiKey;
    this.model = config.model || 'command-r';
    this.baseUrl = config.baseUrl || 'https://api.cohere.ai/v1';
    this.timeout = config.timeout || 30000;

    if (!COHERE_MODELS.includes(this.model)) {
      throw new Error(`Unsupported model: ${this.model}. Supported: ${COHERE_MODELS.join(', ')}`);
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        return {
          valid: false,
          models: [],
          error: error.message || `HTTP ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        valid: true,
        models: COHERE_MODELS,
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

    // Convert messages to Cohere format
    const chatHistory = params.messages
      .filter(m => m.role !== 'system')
      .slice(0, -1)
      .map(m => ({
        role: m.role === 'user' ? 'USER' : 'CHATBOT',
        message: m.content,
      }));

    const lastMessage = params.messages[params.messages.length - 1];
    const systemMessage = params.messages.find(m => m.role === 'system');

    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        message: lastMessage.content,
        chat_history: chatHistory.length > 0 ? chatHistory : undefined,
        preamble: systemMessage?.content,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1000,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.text || '',
      model: model,
      usage: {
        promptTokens: data.meta?.billed_units?.input_tokens || 0,
        completionTokens: data.meta?.billed_units?.output_tokens || 0,
        totalTokens: (data.meta?.billed_units?.input_tokens || 0) + (data.meta?.billed_units?.output_tokens || 0),
      },
      finishReason: data.finish_reason === 'COMPLETE' ? 'stop' : 'length',
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
    return MODEL_CAPABILITIES[this.model] || MODEL_CAPABILITIES['command-r'];
  }

  getSupportedModels(): string[] {
    return COHERE_MODELS;
  }
}
