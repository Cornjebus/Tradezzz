/**
 * Ollama Adapter - Local AI models with no API costs
 *
 * Supports any model available in Ollama (llama3, mistral, codellama, etc.)
 * Runs locally - complete privacy, no usage tracking
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

const DEFAULT_MODELS = [
  'llama3.2',
  'llama3.1',
  'mistral',
  'codellama',
  'phi3',
  'gemma2',
];

export class OllamaAdapter implements AIAdapter {
  readonly name = 'Ollama';
  readonly provider = 'ollama';

  private model: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AIAdapterConfig) {
    // Ollama doesn't require an API key (local)
    this.model = config.model || 'llama3.2';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 120000; // Local can be slow on first load
  }

  async testConnection(): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      // Check if Ollama is running
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return {
          valid: false,
          models: [],
          error: `Ollama not responding: HTTP ${response.status}`,
          latencyMs: Date.now() - startTime,
        };
      }

      const data = await response.json();
      const availableModels = data.models?.map((m: any) => m.name) || [];

      // Check if our model is available
      const modelAvailable = availableModels.some((m: string) =>
        m.startsWith(this.model) || m.includes(this.model)
      );

      if (!modelAvailable && availableModels.length > 0) {
        return {
          valid: true,
          models: availableModels,
          error: `Model '${this.model}' not found. Available: ${availableModels.slice(0, 5).join(', ')}`,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        valid: true,
        models: availableModels.length > 0 ? availableModels : DEFAULT_MODELS,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        valid: false,
        models: [],
        error: error.message?.includes('ECONNREFUSED')
          ? 'Ollama not running. Start with: ollama serve'
          : error.message || 'Connection failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    const startTime = Date.now();
    const model = params.model || this.model;

    // Build messages with system prompt
    const messages = params.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? 1000,
        },
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      model: data.model || model,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      finishReason: data.done ? 'stop' : 'length',
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
    // Capabilities vary by model, these are conservative defaults
    return {
      streaming: true,
      functionCalling: false, // Most Ollama models don't support this
      vision: false, // Only some models (llava)
      maxContextTokens: 8192, // Varies by model
      maxOutputTokens: 2048,
    };
  }

  getSupportedModels(): string[] {
    return DEFAULT_MODELS;
  }
}
