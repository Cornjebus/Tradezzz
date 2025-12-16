/**
 * AI Adapter Types - Shared interfaces for all AI provider adapters
 */

export interface AIAdapterConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  latencyMs: number;
}

export interface SentimentParams {
  text: string;
  symbol?: string;
}

export interface SentimentResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  reasoning: string;
}

export interface TradingSignalParams {
  symbol: string;
  price: number;
  indicators: Record<string, number>;
  context?: string;
}

export interface TradingSignalResult {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedSize: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface AdapterCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface TestConnectionResult {
  valid: boolean;
  models: string[];
  error?: string;
  latencyMs: number;
}

/**
 * Base interface for all AI provider adapters
 */
export interface AIAdapter {
  readonly name: string;
  readonly provider: string;

  // Core methods
  testConnection(): Promise<TestConnectionResult>;
  chat(params: ChatCompletionParams): Promise<ChatCompletionResult>;
  analyzeSentiment(params: SentimentParams): Promise<SentimentResult>;
  generateSignal(params: TradingSignalParams): Promise<TradingSignalResult>;

  // Capabilities
  getCapabilities(): AdapterCapabilities;
  getSupportedModels(): string[];
}
