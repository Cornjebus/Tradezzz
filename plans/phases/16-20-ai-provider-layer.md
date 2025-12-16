# AI Provider Abstraction Layer - TDD Implementation Plan

## 🎯 Overview

This document defines the architecture for user-selectable AI providers. Users bring their own API keys and pay for their own AI usage - just like they bring their own exchange accounts.

**Philosophy**: Users connect their own AI, just like they connect their own exchange.

**Last Updated**: December 2024
**AI Model Data**: Verified via web search December 2024

---

## 📋 Table of Contents

1. [Supported AI Providers](#supported-ai-providers)
2. [Architecture](#architecture)
3. [Phase 16: AI Provider Interface](#phase-16-ai-provider-interface)
4. [Phase 17: Provider Adapters](#phase-17-provider-adapters)
5. [Phase 18: AI Key Security](#phase-18-ai-key-security)
6. [Phase 19: Usage Tracking & Cost Estimation](#phase-19-usage-tracking--cost-estimation)
7. [Phase 20: Fallback & Reliability](#phase-20-fallback--reliability)
8. [User Experience](#user-experience)
9. [Implementation Timeline](#implementation-timeline)

---

## 🤖 Supported AI Providers

### Tier 1: Full Support (Launch)

| Provider | Models | Best For | Pricing (per 1M tokens) |
|----------|--------|----------|-------------------------|
| **OpenAI** | GPT-5.2, GPT-4.1, o3, o4-mini | Complex reasoning, coding | Input: $2.50-15 / Output: $10-60 |
| **Anthropic** | Claude Opus 4.5, Claude Sonnet 4, Claude 3.7 | Nuanced analysis, safety | Input: $3-15 / Output: $15-75 |
| **Google** | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash | Multimodal, speed | Input: $1.25-7 / Output: $5-21 |
| **DeepSeek** | DeepSeek-V3.2, DeepSeek-R1 | Cost efficiency, reasoning | Input: $0.55 / Output: $2.19 |

### Tier 2: Supported (Post-Launch)

| Provider | Models | Best For | Pricing |
|----------|--------|----------|---------|
| **xAI** | Grok 4.1, Grok 4, Grok 3 | Real-time data, X integration | Varies |
| **Groq** | Llama 3.3 70B, Mixtral 8x22B | Ultra-fast inference | Very low |
| **Mistral** | Mistral Large, Codestral 25.01, Devstral 2 | Code generation, EU hosting | Mid-range |

### Tier 3: Local/Self-Hosted

| Provider | Models | Best For | Cost |
|----------|--------|----------|------|
| **Ollama** | Llama 3.3, Qwen 3, Mistral, Phi-4 | Privacy, no API costs | Electricity only |
| **LM Studio** | Any GGUF model | Desktop users | Free |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DASHBOARD                           │
│                                                                   │
│   "Connect Your AI" (just like "Connect Your Exchange")          │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI PROVIDER SERVICE                         │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  AIProviderFactory                       │   │
│   │                                                          │   │
│   │   create(provider, config) → AIProvider                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                │                                  │
│          ┌────────────────────┼────────────────────┐             │
│          ▼                    ▼                    ▼             │
│   ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│   │  OpenAI    │      │ Anthropic  │      │  Google    │        │
│   │  Adapter   │      │  Adapter   │      │  Adapter   │        │
│   └────────────┘      └────────────┘      └────────────┘        │
│          │                    │                    │             │
│          ▼                    ▼                    ▼             │
│   ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│   │ DeepSeek   │      │   Groq     │      │  Mistral   │        │
│   │  Adapter   │      │  Adapter   │      │  Adapter   │        │
│   └────────────┘      └────────────┘      └────────────┘        │
│          │                    │                    │             │
│          ▼                    ▼                    ▼             │
│   ┌────────────┐      ┌────────────┐      ┌────────────┐        │
│   │    xAI     │      │  Ollama    │      │ LM Studio  │        │
│   │  Adapter   │      │  Adapter   │      │  Adapter   │        │
│   └────────────┘      └────────────┘      └────────────┘        │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      UNIFIED AI INTERFACE                        │
│                                                                   │
│   analyze(prompt, context) → Analysis                            │
│   generateSignal(marketData) → TradingSignal                     │
│   explainDecision(decision) → string                             │
│   assessRisk(portfolio, market) → RiskAssessment                 │
│   parseSentiment(text) → SentimentScore                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Phase 16: AI Provider Interface

### 16.1 Core Interface (Test-First)

**Test File**: `src/ai/providers/AIProvider.interface.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  AIProvider,
  AIProviderCapabilities,
  AnalysisRequest,
  AnalysisResponse,
  TradingSignal,
  SentimentResult
} from './AIProvider.interface';

describe('AIProvider Interface', () => {

  describe('Required Methods', () => {
    it('should_define_analyze_method', () => {
      const mockProvider: AIProvider = createMockProvider();

      expect(mockProvider.analyze).toBeDefined();
      expect(typeof mockProvider.analyze).toBe('function');
    });

    it('should_define_generateSignal_method', () => {
      const mockProvider: AIProvider = createMockProvider();

      expect(mockProvider.generateSignal).toBeDefined();
    });

    it('should_define_explainDecision_method', () => {
      const mockProvider: AIProvider = createMockProvider();

      expect(mockProvider.explainDecision).toBeDefined();
    });

    it('should_define_assessRisk_method', () => {
      const mockProvider: AIProvider = createMockProvider();

      expect(mockProvider.assessRisk).toBeDefined();
    });

    it('should_define_parseSentiment_method', () => {
      const mockProvider: AIProvider = createMockProvider();

      expect(mockProvider.parseSentiment).toBeDefined();
    });
  });

  describe('Capabilities Declaration', () => {
    it('should_declare_supported_capabilities', () => {
      const mockProvider: AIProvider = createMockProvider();
      const capabilities = mockProvider.getCapabilities();

      expect(capabilities.streaming).toBeDefined();
      expect(capabilities.functionCalling).toBeDefined();
      expect(capabilities.vision).toBeDefined();
      expect(capabilities.maxContextTokens).toBeGreaterThan(0);
      expect(capabilities.maxOutputTokens).toBeGreaterThan(0);
    });
  });

  describe('Response Format', () => {
    it('should_return_standardized_analysis_response', async () => {
      const mockProvider: AIProvider = createMockProvider();

      const response = await mockProvider.analyze({
        prompt: 'Analyze BTC market conditions',
        context: { price: 45000, volume: 1000000 }
      });

      expect(response.content).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.tokensUsed).toBeDefined();
      expect(response.tokensUsed.input).toBeGreaterThan(0);
      expect(response.tokensUsed.output).toBeGreaterThan(0);
      expect(response.model).toBeDefined();
      expect(response.latencyMs).toBeGreaterThan(0);
    });

    it('should_return_standardized_trading_signal', async () => {
      const mockProvider: AIProvider = createMockProvider();

      const signal = await mockProvider.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 25, macd: -100 },
        sentiment: 0.3
      });

      expect(signal.action).toMatch(/buy|sell|hold/);
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
      expect(signal.reasoning).toBeDefined();
      expect(signal.suggestedSize).toBeGreaterThanOrEqual(0);
      expect(signal.suggestedSize).toBeLessThanOrEqual(1);
    });

    it('should_return_standardized_sentiment_result', async () => {
      const mockProvider: AIProvider = createMockProvider();

      const sentiment = await mockProvider.parseSentiment(
        'Bitcoin is mooning! Best investment ever! 🚀🚀🚀'
      );

      expect(sentiment.score).toBeGreaterThanOrEqual(-1);
      expect(sentiment.score).toBeLessThanOrEqual(1);
      expect(sentiment.magnitude).toBeGreaterThanOrEqual(0);
      expect(sentiment.aspects).toBeDefined();
    });
  });
});

// Type definitions
interface AIProvider {
  readonly name: string;
  readonly version: string;

  // Core methods
  analyze(request: AnalysisRequest): Promise<AnalysisResponse>;
  generateSignal(marketData: MarketData): Promise<TradingSignal>;
  explainDecision(decision: Decision): Promise<string>;
  assessRisk(portfolio: Portfolio, market: MarketConditions): Promise<RiskAssessment>;
  parseSentiment(text: string): Promise<SentimentResult>;

  // Capabilities
  getCapabilities(): AIProviderCapabilities;

  // Connection
  testConnection(): Promise<boolean>;
  disconnect(): Promise<void>;
}

interface AIProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportedModels: string[];
}

interface AnalysisResponse {
  content: string;
  confidence: number;
  tokensUsed: { input: number; output: number };
  model: string;
  latencyMs: number;
}

interface TradingSignal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reasoning: string;
  suggestedSize: number; // 0-1 (percentage of available capital)
  stopLoss?: number;
  takeProfit?: number;
}

interface SentimentResult {
  score: number; // -1 to 1
  magnitude: number; // 0 to infinity (how strong)
  aspects: {
    topic: string;
    sentiment: number;
  }[];
}
```

### 16.2 Provider Factory (Test-First)

**Test File**: `src/ai/providers/AIProviderFactory.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AIProviderFactory } from './AIProviderFactory';
import { OpenAIProvider } from './adapters/OpenAIProvider';
import { AnthropicProvider } from './adapters/AnthropicProvider';
import { GoogleProvider } from './adapters/GoogleProvider';
import { DeepSeekProvider } from './adapters/DeepSeekProvider';
import { GroqProvider } from './adapters/GroqProvider';
import { MistralProvider } from './adapters/MistralProvider';
import { XAIProvider } from './adapters/XAIProvider';
import { OllamaProvider } from './adapters/OllamaProvider';

describe('AIProviderFactory', () => {

  describe('Provider Creation', () => {

    // OpenAI
    it('should_create_openai_provider', () => {
      const provider = AIProviderFactory.create('openai', {
        apiKey: 'sk-test-key',
        model: 'gpt-5.2'
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.name).toBe('openai');
    });

    it('should_support_all_openai_models', () => {
      const models = AIProviderFactory.getSupportedModels('openai');

      expect(models).toContain('gpt-5.2');
      expect(models).toContain('gpt-4.1');
      expect(models).toContain('gpt-4.1-mini');
      expect(models).toContain('gpt-4.1-nano');
      expect(models).toContain('o3');
      expect(models).toContain('o4-mini');
      expect(models).toContain('o1-pro');
      expect(models).toContain('gpt-4o');
    });

    // Anthropic
    it('should_create_anthropic_provider', () => {
      const provider = AIProviderFactory.create('anthropic', {
        apiKey: 'sk-ant-test-key',
        model: 'claude-opus-4.5'
      });

      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.name).toBe('anthropic');
    });

    it('should_support_all_anthropic_models', () => {
      const models = AIProviderFactory.getSupportedModels('anthropic');

      expect(models).toContain('claude-opus-4.5');
      expect(models).toContain('claude-sonnet-4');
      expect(models).toContain('claude-3.7-sonnet');
      expect(models).toContain('claude-3.5-sonnet');
      expect(models).toContain('claude-3.5-haiku');
    });

    // Google
    it('should_create_google_provider', () => {
      const provider = AIProviderFactory.create('google', {
        apiKey: 'test-google-key',
        model: 'gemini-2.5-pro'
      });

      expect(provider).toBeInstanceOf(GoogleProvider);
    });

    it('should_support_all_google_models', () => {
      const models = AIProviderFactory.getSupportedModels('google');

      expect(models).toContain('gemini-2.5-pro');
      expect(models).toContain('gemini-2.5-flash');
      expect(models).toContain('gemini-2.0-flash');
      expect(models).toContain('gemini-3-deep-think');
    });

    // DeepSeek
    it('should_create_deepseek_provider', () => {
      const provider = AIProviderFactory.create('deepseek', {
        apiKey: 'test-deepseek-key',
        model: 'deepseek-v3.2'
      });

      expect(provider).toBeInstanceOf(DeepSeekProvider);
    });

    it('should_support_all_deepseek_models', () => {
      const models = AIProviderFactory.getSupportedModels('deepseek');

      expect(models).toContain('deepseek-v3.2');
      expect(models).toContain('deepseek-v3.2-speciale');
      expect(models).toContain('deepseek-r1');
      expect(models).toContain('deepseek-chat');
      expect(models).toContain('deepseek-reasoner');
    });

    // Groq
    it('should_create_groq_provider', () => {
      const provider = AIProviderFactory.create('groq', {
        apiKey: 'test-groq-key',
        model: 'llama-3.3-70b-versatile'
      });

      expect(provider).toBeInstanceOf(GroqProvider);
    });

    it('should_support_all_groq_models', () => {
      const models = AIProviderFactory.getSupportedModels('groq');

      expect(models).toContain('llama-3.3-70b-versatile');
      expect(models).toContain('llama-3.3-70b-specdec');
      expect(models).toContain('mixtral-8x7b-32768');
      expect(models).toContain('llama-3.2-90b-vision-preview');
      expect(models).toContain('llama-3.2-11b-vision-preview');
    });

    // Mistral
    it('should_create_mistral_provider', () => {
      const provider = AIProviderFactory.create('mistral', {
        apiKey: 'test-mistral-key',
        model: 'mistral-large-latest'
      });

      expect(provider).toBeInstanceOf(MistralProvider);
    });

    it('should_support_all_mistral_models', () => {
      const models = AIProviderFactory.getSupportedModels('mistral');

      expect(models).toContain('mistral-large-latest');
      expect(models).toContain('mistral-small-latest');
      expect(models).toContain('codestral-latest');
      expect(models).toContain('devstral-small-latest');
      expect(models).toContain('devstral-medium-latest');
    });

    // xAI (Grok)
    it('should_create_xai_provider', () => {
      const provider = AIProviderFactory.create('xai', {
        apiKey: 'test-xai-key',
        model: 'grok-4.1'
      });

      expect(provider).toBeInstanceOf(XAIProvider);
    });

    it('should_support_all_xai_models', () => {
      const models = AIProviderFactory.getSupportedModels('xai');

      expect(models).toContain('grok-4.1');
      expect(models).toContain('grok-4.1-fast');
      expect(models).toContain('grok-4');
      expect(models).toContain('grok-3');
      expect(models).toContain('grok-2-vision-1212');
    });

    // Ollama (Local)
    it('should_create_ollama_provider', () => {
      const provider = AIProviderFactory.create('ollama', {
        baseUrl: 'http://localhost:11434',
        model: 'llama3.3'
      });

      expect(provider).toBeInstanceOf(OllamaProvider);
    });

    it('should_support_common_ollama_models', () => {
      const models = AIProviderFactory.getSupportedModels('ollama');

      expect(models).toContain('llama3.3');
      expect(models).toContain('llama3.2');
      expect(models).toContain('qwen3');
      expect(models).toContain('qwen2.5-coder');
      expect(models).toContain('mistral');
      expect(models).toContain('mixtral');
      expect(models).toContain('phi4');
      expect(models).toContain('deepseek-r1');
    });
  });

  describe('Error Handling', () => {
    it('should_throw_for_unsupported_provider', () => {
      expect(() =>
        AIProviderFactory.create('unsupported_provider', { apiKey: 'key' })
      ).toThrow('Unsupported AI provider: unsupported_provider');
    });

    it('should_throw_for_missing_api_key', () => {
      expect(() =>
        AIProviderFactory.create('openai', { model: 'gpt-4' })
      ).toThrow('API key required for openai');
    });

    it('should_not_require_api_key_for_ollama', () => {
      expect(() =>
        AIProviderFactory.create('ollama', {
          baseUrl: 'http://localhost:11434',
          model: 'llama3.3'
        })
      ).not.toThrow();
    });

    it('should_throw_for_unsupported_model', () => {
      expect(() =>
        AIProviderFactory.create('openai', {
          apiKey: 'key',
          model: 'gpt-99-turbo-ultra'
        })
      ).toThrow('Model gpt-99-turbo-ultra not supported by openai');
    });
  });

  describe('Provider Discovery', () => {
    it('should_list_all_supported_providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('deepseek');
      expect(providers).toContain('groq');
      expect(providers).toContain('mistral');
      expect(providers).toContain('xai');
      expect(providers).toContain('ollama');
    });

    it('should_provide_provider_metadata', () => {
      const metadata = AIProviderFactory.getProviderMetadata('openai');

      expect(metadata.name).toBe('OpenAI');
      expect(metadata.website).toBe('https://platform.openai.com');
      expect(metadata.description).toContain('GPT');
      expect(metadata.pricingUrl).toBeDefined();
      expect(metadata.requiresApiKey).toBe(true);
    });

    it('should_indicate_local_providers', () => {
      const ollamaMetadata = AIProviderFactory.getProviderMetadata('ollama');

      expect(ollamaMetadata.isLocal).toBe(true);
      expect(ollamaMetadata.requiresApiKey).toBe(false);
    });
  });
});
```

---

## 🔌 Phase 17: Provider Adapters (Full-Stack)

> **IMPORTANT**: Phase 17 follows full-stack development. Each adapter includes backend + frontend + tests in a single commit.

### 17.0 Frontend Requirements (Per Adapter)

For EACH provider adapter (OpenAI, Anthropic, etc.), implement:

**Backend:**
- Provider adapter class with all interface methods
- Tests for connection, analysis, signals, sentiment
- Route handlers for chat/analyze endpoints

**Frontend (useApi.ts + UI):**
```typescript
// Add to useApi.ts
export function useAIChat(providerId: string) {
  const api = useApi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async (prompt: string) => {
    const result = await api.post(`/api/ai/providers/${providerId}/chat`, { prompt });
    if (result.success) {
      setMessages(prev => [...prev, { role: 'assistant', content: result.data.content }]);
    }
    return result;
  };

  return { messages, sendMessage, streaming };
}
```

**UI Components:**
```
src/ui/components/providers/
├── AIProvidersTab.tsx         # Already exists - add test panel
├── ProviderTestPanel.tsx      # NEW: Test connection with real API call
├── ProviderChatPanel.tsx      # NEW: Interactive chat test
└── ProviderUsageStats.tsx     # NEW: Show real-time usage
```

**Per-Provider UI Updates:**
| Provider | Test Panel | Chat Panel | Usage Display |
|----------|------------|------------|---------------|
| OpenAI | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ✅ | ✅ |
| Google | ✅ | ✅ | ✅ |
| DeepSeek | ✅ | ✅ | ✅ |
| Groq | ✅ | ❌ (no streaming) | ✅ |
| Mistral | ✅ | ✅ | ✅ |
| xAI | ✅ | ✅ | ✅ |
| Ollama | ✅ (local check) | ✅ | ✅ (no cost) |

### 17.1 OpenAI Adapter (Test-First)

**Test File**: `src/ai/providers/adapters/OpenAIProvider.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider';
import { createMockOpenAIClient } from '../../../../tests/helpers/mock-openai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockOpenAIClient();
    provider = new OpenAIProvider({
      apiKey: 'sk-test-key',
      model: 'gpt-5.2'
    });
    provider.setClient(mockClient);
  });

  describe('Connection', () => {
    it('should_test_connection_successfully', async () => {
      mockClient.models.list = vi.fn().mockResolvedValue({
        data: [{ id: 'gpt-5.2' }]
      });

      const isConnected = await provider.testConnection();

      expect(isConnected).toBe(true);
    });

    it('should_fail_connection_with_invalid_key', async () => {
      mockClient.models.list = vi.fn().mockRejectedValue({
        status: 401,
        message: 'Invalid API key'
      });

      const isConnected = await provider.testConnection();

      expect(isConnected).toBe(false);
    });
  });

  describe('Market Analysis', () => {
    it('should_analyze_market_conditions', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        id: 'chatcmpl-123',
        choices: [{
          message: {
            content: JSON.stringify({
              sentiment: 'bullish',
              confidence: 0.75,
              keyFactors: ['RSI oversold', 'Volume spike'],
              recommendation: 'Consider long position'
            })
          }
        }],
        usage: { prompt_tokens: 150, completion_tokens: 80 },
        model: 'gpt-5.2'
      });

      const analysis = await provider.analyze({
        prompt: 'Analyze BTC market',
        context: {
          symbol: 'BTC/USDT',
          price: 45000,
          indicators: { rsi: 28, macd: -150 }
        }
      });

      expect(analysis.content).toContain('bullish');
      expect(analysis.confidence).toBe(0.75);
      expect(analysis.tokensUsed.input).toBe(150);
      expect(analysis.tokensUsed.output).toBe(80);
    });

    it('should_handle_json_response_parsing', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '```json\n{"action": "buy", "confidence": 0.8}\n```'
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50 }
      });

      const analysis = await provider.analyze({
        prompt: 'Generate trading signal',
        responseFormat: 'json'
      });

      const parsed = JSON.parse(analysis.content);
      expect(parsed.action).toBe('buy');
    });
  });

  describe('Trading Signal Generation', () => {
    it('should_generate_buy_signal', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: 'buy',
              confidence: 0.82,
              reasoning: 'RSI indicates oversold, MACD showing bullish divergence',
              suggestedSize: 0.15,
              stopLoss: 43500,
              takeProfit: 48000
            })
          }
        }],
        usage: { prompt_tokens: 200, completion_tokens: 100 }
      });

      const signal = await provider.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: { rsi: 25, macd: -100, volume: 1500000 }
      });

      expect(signal.action).toBe('buy');
      expect(signal.confidence).toBe(0.82);
      expect(signal.suggestedSize).toBe(0.15);
      expect(signal.stopLoss).toBe(43500);
      expect(signal.takeProfit).toBe(48000);
    });

    it('should_generate_hold_signal_when_uncertain', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              action: 'hold',
              confidence: 0.45,
              reasoning: 'Mixed signals, market consolidating',
              suggestedSize: 0
            })
          }
        }],
        usage: { prompt_tokens: 200, completion_tokens: 80 }
      });

      const signal = await provider.generateSignal({
        symbol: 'ETH/USDT',
        price: 2500,
        indicators: { rsi: 50, macd: 0 }
      });

      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBeLessThan(0.5);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should_parse_bullish_sentiment', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 0.85,
              magnitude: 1.2,
              aspects: [
                { topic: 'price', sentiment: 0.9 },
                { topic: 'technology', sentiment: 0.7 }
              ]
            })
          }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 40 }
      });

      const sentiment = await provider.parseSentiment(
        'Bitcoin is revolutionizing finance! ATH incoming! 🚀'
      );

      expect(sentiment.score).toBeGreaterThan(0.5);
      expect(sentiment.magnitude).toBeGreaterThan(1);
    });

    it('should_parse_bearish_sentiment', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: -0.7,
              magnitude: 0.9,
              aspects: [
                { topic: 'market', sentiment: -0.8 },
                { topic: 'regulation', sentiment: -0.6 }
              ]
            })
          }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 40 }
      });

      const sentiment = await provider.parseSentiment(
        'Crypto crash imminent. Sell everything before it goes to zero.'
      );

      expect(sentiment.score).toBeLessThan(-0.5);
    });
  });

  describe('Streaming', () => {
    it('should_support_streaming_responses', async () => {
      const chunks = ['The ', 'market ', 'looks ', 'bullish.'];
      const mockStream = createMockStream(chunks);

      mockClient.chat.completions.create = vi.fn().mockResolvedValue(mockStream);

      const receivedChunks: string[] = [];

      await provider.analyzeStream({
        prompt: 'Analyze market',
        onChunk: (chunk) => receivedChunks.push(chunk)
      });

      expect(receivedChunks.join('')).toBe('The market looks bullish.');
    });
  });

  describe('o3 Reasoning Model', () => {
    it('should_use_extended_thinking_for_o3', async () => {
      provider = new OpenAIProvider({
        apiKey: 'sk-test-key',
        model: 'o3'
      });
      provider.setClient(mockClient);

      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Deep analysis result',
            reasoning_content: 'Step 1: Analyzed RSI... Step 2: Checked MACD...'
          }
        }],
        usage: { prompt_tokens: 500, completion_tokens: 1000, reasoning_tokens: 800 }
      });

      const analysis = await provider.analyze({
        prompt: 'Complex market analysis',
        useReasoning: true
      });

      expect(analysis.reasoning).toContain('Step 1');
      expect(analysis.tokensUsed.reasoning).toBe(800);
    });
  });

  describe('Error Handling', () => {
    it('should_handle_rate_limiting', async () => {
      mockClient.chat.completions.create = vi.fn().mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '30' }
      });

      await expect(
        provider.analyze({ prompt: 'Test' })
      ).rejects.toThrow('Rate limited. Retry after 30 seconds.');
    });

    it('should_handle_context_length_exceeded', async () => {
      mockClient.chat.completions.create = vi.fn().mockRejectedValue({
        status: 400,
        code: 'context_length_exceeded',
        message: 'Maximum context length exceeded'
      });

      await expect(
        provider.analyze({ prompt: 'Very long prompt...' })
      ).rejects.toThrow('Input too long');
    });

    it('should_handle_invalid_response_format', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Not JSON at all' }
        }],
        usage: { prompt_tokens: 50, completion_tokens: 20 }
      });

      const signal = await provider.generateSignal({
        symbol: 'BTC/USDT',
        price: 45000,
        indicators: {}
      });

      // Should fall back to hold when parsing fails
      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBe(0);
      expect(signal.reasoning).toContain('Failed to parse');
    });
  });

  describe('Capabilities', () => {
    it('should_report_gpt5_capabilities', () => {
      provider = new OpenAIProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-5.2'
      });

      const capabilities = provider.getCapabilities();

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.functionCalling).toBe(true);
      expect(capabilities.vision).toBe(true);
      expect(capabilities.maxContextTokens).toBeGreaterThanOrEqual(128000);
    });

    it('should_report_o3_capabilities', () => {
      provider = new OpenAIProvider({
        apiKey: 'sk-test-key',
        model: 'o3'
      });

      const capabilities = provider.getCapabilities();

      expect(capabilities.reasoning).toBe(true);
      expect(capabilities.streaming).toBe(true);
    });
  });
});
```

### 17.2 Anthropic Adapter (Test-First)

**Test File**: `src/ai/providers/adapters/AnthropicProvider.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicProvider } from './AnthropicProvider';
import { createMockAnthropicClient } from '../../../../tests/helpers/mock-anthropic';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockAnthropicClient();
    provider = new AnthropicProvider({
      apiKey: 'sk-ant-test-key',
      model: 'claude-opus-4.5'
    });
    provider.setClient(mockClient);
  });

  describe('Connection', () => {
    it('should_test_connection_successfully', async () => {
      mockClient.messages.create = vi.fn().mockResolvedValue({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Hello' }]
      });

      const isConnected = await provider.testConnection();

      expect(isConnected).toBe(true);
    });
  });

  describe('Market Analysis', () => {
    it('should_analyze_with_claude_opus', async () => {
      mockClient.messages.create = vi.fn().mockResolvedValue({
        id: 'msg_123',
        model: 'claude-opus-4.5',
        content: [{
          type: 'text',
          text: JSON.stringify({
            sentiment: 'cautiously_bullish',
            confidence: 0.72,
            analysis: 'Technical indicators suggest...'
          })
        }],
        usage: { input_tokens: 180, output_tokens: 120 }
      });

      const analysis = await provider.analyze({
        prompt: 'Analyze ETH/USDT market',
        context: { price: 2500, rsi: 35 }
      });

      expect(analysis.content).toContain('bullish');
      expect(analysis.model).toBe('claude-opus-4.5');
    });

    it('should_use_extended_thinking_for_complex_analysis', async () => {
      mockClient.messages.create = vi.fn().mockResolvedValue({
        id: 'msg_123',
        content: [
          {
            type: 'thinking',
            thinking: 'Let me analyze this step by step...'
          },
          {
            type: 'text',
            text: 'Based on my analysis...'
          }
        ],
        usage: { input_tokens: 200, output_tokens: 500 }
      });

      const analysis = await provider.analyze({
        prompt: 'Complex multi-factor analysis',
        useExtendedThinking: true
      });

      expect(analysis.thinking).toContain('step by step');
    });
  });

  describe('Claude 3.7 Hybrid Reasoning', () => {
    it('should_support_hybrid_reasoning_mode', async () => {
      provider = new AnthropicProvider({
        apiKey: 'sk-ant-test-key',
        model: 'claude-3.7-sonnet'
      });
      provider.setClient(mockClient);

      mockClient.messages.create = vi.fn().mockResolvedValue({
        id: 'msg_456',
        content: [{
          type: 'text',
          text: 'Hybrid reasoning result'
        }],
        usage: { input_tokens: 150, output_tokens: 200 }
      });

      const analysis = await provider.analyze({
        prompt: 'Analyze with hybrid reasoning',
        reasoningMode: 'hybrid'
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3.7-sonnet'
        })
      );
    });
  });

  describe('Computer Use', () => {
    it('should_support_computer_use_capability', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.computerUse).toBe(true);
    });
  });

  describe('Safety', () => {
    it('should_handle_content_policy_rejection', async () => {
      mockClient.messages.create = vi.fn().mockRejectedValue({
        status: 400,
        error: {
          type: 'content_policy_violation',
          message: 'Content blocked by safety system'
        }
      });

      await expect(
        provider.analyze({ prompt: 'Blocked content' })
      ).rejects.toThrow('Content blocked by safety policy');
    });
  });

  describe('Capabilities', () => {
    it('should_report_opus_4.5_capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.vision).toBe(true);
      expect(capabilities.computerUse).toBe(true);
      expect(capabilities.maxContextTokens).toBeGreaterThanOrEqual(200000);
    });
  });
});
```

### 17.3 DeepSeek Adapter (Test-First)

**Test File**: `src/ai/providers/adapters/DeepSeekProvider.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeepSeekProvider } from './DeepSeekProvider';

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockDeepSeekClient();
    provider = new DeepSeekProvider({
      apiKey: 'test-deepseek-key',
      model: 'deepseek-v3.2'
    });
    provider.setClient(mockClient);
  });

  describe('Cost Efficiency', () => {
    it('should_track_low_cost_usage', async () => {
      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Analysis result' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 }
      });

      const analysis = await provider.analyze({
        prompt: 'Market analysis'
      });

      // DeepSeek costs ~$0.55/M input, $2.19/M output
      const estimatedCost = provider.estimateCost(analysis.tokensUsed);
      expect(estimatedCost).toBeLessThan(0.01); // Should be very cheap
    });
  });

  describe('Reasoner Model', () => {
    it('should_use_deepseek_reasoner_for_complex_tasks', async () => {
      provider = new DeepSeekProvider({
        apiKey: 'test-key',
        model: 'deepseek-reasoner'
      });
      provider.setClient(mockClient);

      mockClient.chat.completions.create = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Reasoned analysis',
            reasoning_content: 'Step by step reasoning...'
          }
        }],
        usage: { prompt_tokens: 500, completion_tokens: 1000 }
      });

      const analysis = await provider.analyze({
        prompt: 'Complex market scenario',
        useReasoning: true
      });

      expect(analysis.reasoning).toBeDefined();
    });
  });

  describe('V3.2-Speciale', () => {
    it('should_use_speciale_model_when_specified', async () => {
      provider = new DeepSeekProvider({
        apiKey: 'test-key',
        model: 'deepseek-v3.2-speciale'
      });

      const capabilities = provider.getCapabilities();

      expect(capabilities.supportedModels).toContain('deepseek-v3.2-speciale');
    });
  });
});
```

### 17.4 Ollama Adapter (Test-First)

**Test File**: `src/ai/providers/adapters/OllamaProvider.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaProvider } from './OllamaProvider';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.3'
    });
  });

  describe('Local Connection', () => {
    it('should_not_require_api_key', () => {
      expect(() =>
        new OllamaProvider({
          baseUrl: 'http://localhost:11434',
          model: 'llama3.3'
        })
      ).not.toThrow();
    });

    it('should_test_local_connection', async () => {
      // Mock fetch for local connection
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'llama3.3' }] })
      });

      const isConnected = await provider.testConnection();

      expect(isConnected).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags'
      );
    });

    it('should_detect_when_ollama_not_running', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const isConnected = await provider.testConnection();

      expect(isConnected).toBe(false);
    });
  });

  describe('Model Management', () => {
    it('should_list_available_local_models', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            { name: 'llama3.3:latest' },
            { name: 'qwen3:latest' },
            { name: 'mistral:latest' }
          ]
        })
      });

      const models = await provider.listLocalModels();

      expect(models).toContain('llama3.3:latest');
      expect(models).toContain('qwen3:latest');
    });

    it('should_pull_model_if_not_available', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ models: [] }) // No models
        })
        .mockResolvedValueOnce({
          ok: true,
          body: createMockReadableStream(['Pulling...', 'Done'])
        });

      await provider.ensureModelAvailable('llama3.3');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'llama3.3' })
        })
      );
    });
  });

  describe('Market Analysis (Local)', () => {
    it('should_analyze_without_internet', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          response: JSON.stringify({
            sentiment: 'neutral',
            confidence: 0.65,
            analysis: 'Based on technical indicators...'
          }),
          eval_count: 150,
          prompt_eval_count: 100
        })
      });

      const analysis = await provider.analyze({
        prompt: 'Analyze BTC/USDT',
        context: { price: 45000, rsi: 50 }
      });

      expect(analysis.content).toContain('neutral');
      expect(analysis.tokensUsed.input).toBe(100);
      expect(analysis.tokensUsed.output).toBe(150);
    });
  });

  describe('Privacy', () => {
    it('should_never_send_data_externally', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      await provider.analyze({
        prompt: 'Sensitive analysis',
        context: { secret: 'data' }
      });

      // All calls should be to localhost
      for (const call of fetchSpy.mock.calls) {
        expect(call[0]).toContain('localhost:11434');
      }
    });
  });

  describe('Tool Calling', () => {
    it('should_support_tool_calling_with_compatible_models', async () => {
      provider = new OllamaProvider({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.3'  // Supports tool calling
      });

      const capabilities = provider.getCapabilities();

      expect(capabilities.functionCalling).toBe(true);
    });
  });

  describe('Zero Cost', () => {
    it('should_report_zero_api_cost', () => {
      const cost = provider.estimateCost({
        input: 10000,
        output: 5000
      });

      expect(cost).toBe(0);
    });
  });
});
```

---

## 🔐 Phase 18: AI Key Security

### 18.1 AI Key Vault (Test-First)

**Test File**: `src/ai/security/AIKeyVault.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIKeyVault } from './AIKeyVault';

describe('AIKeyVault', () => {
  let vault: AIKeyVault;

  beforeEach(async () => {
    const db = await createTestDatabase();
    vault = new AIKeyVault(db);
  });

  describe('Storage', () => {
    it('should_encrypt_ai_api_keys', async () => {
      const result = await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-proj-my-secret-key-12345'
      });

      const raw = await vault.getRaw(result.id);

      expect(raw.apiKey).not.toBe('sk-proj-my-secret-key-12345');
      expect(raw.apiKey).not.toContain('sk-proj');
    });

    it('should_store_keys_per_provider', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-openai-key'
      });

      await vault.store({
        userId: 'user_1',
        provider: 'anthropic',
        apiKey: 'sk-ant-key'
      });

      const keys = await vault.listProviders('user_1');

      expect(keys).toContain('openai');
      expect(keys).toContain('anthropic');
    });
  });

  describe('Validation', () => {
    it('should_validate_openai_key_format', async () => {
      const validation = await vault.validateKeyFormat('openai', 'sk-proj-abc123');

      expect(validation.valid).toBe(true);
    });

    it('should_reject_invalid_openai_key_format', async () => {
      const validation = await vault.validateKeyFormat('openai', 'invalid-key');

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('format');
    });

    it('should_validate_anthropic_key_format', async () => {
      const validation = await vault.validateKeyFormat('anthropic', 'sk-ant-api03-abc123');

      expect(validation.valid).toBe(true);
    });

    it('should_test_key_against_provider', async () => {
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(true)
      };

      const result = await vault.testKey('openai', 'sk-test-key', mockProvider);

      expect(result.valid).toBe(true);
      expect(result.models).toBeDefined();
    });

    it('should_detect_invalid_key', async () => {
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(false)
      };

      const result = await vault.testKey('openai', 'sk-invalid', mockProvider);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  describe('Security', () => {
    it('should_never_log_api_keys', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-SECRET-KEY-12345'
      });

      const allLogs = consoleSpy.mock.calls.flat().join(' ');

      expect(allLogs).not.toContain('SECRET');
      expect(allLogs).not.toContain('sk-');
    });

    it('should_mask_key_for_display', () => {
      const masked = vault.maskForDisplay('sk-proj-abc123xyz789');

      expect(masked).toBe('sk-p***789');
      expect(masked).not.toContain('abc123');
    });

    it('should_require_password_to_view_key', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-secret'
      });

      await expect(
        vault.retrieve('user_1', 'openai')
      ).rejects.toThrow('Password required');
    });

    it('should_decrypt_with_correct_password', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-my-key'
      });

      const key = await vault.retrieve('user_1', 'openai', {
        password: 'correct_password'
      });

      expect(key.apiKey).toBe('sk-my-key');
    });
  });

  describe('Rotation', () => {
    it('should_support_key_rotation', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-old-key'
      });

      await vault.rotate({
        userId: 'user_1',
        provider: 'openai',
        newApiKey: 'sk-new-key',
        password: 'password'
      });

      const key = await vault.retrieve('user_1', 'openai', {
        password: 'password'
      });

      expect(key.apiKey).toBe('sk-new-key');
    });

    it('should_log_rotation_in_audit_trail', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-old'
      });

      await vault.rotate({
        userId: 'user_1',
        provider: 'openai',
        newApiKey: 'sk-new',
        password: 'password'
      });

      const logs = await vault.getAuditLogs('user_1');

      expect(logs.find(l => l.action === 'ai_key_rotated')).toBeDefined();
    });
  });

  describe('Deletion', () => {
    it('should_delete_key_securely', async () => {
      await vault.store({
        userId: 'user_1',
        provider: 'openai',
        apiKey: 'sk-to-delete'
      });

      await vault.delete('user_1', 'openai');

      const providers = await vault.listProviders('user_1');

      expect(providers).not.toContain('openai');
    });
  });
});
```

---

## 📊 Phase 19: Usage Tracking & Cost Estimation

### 19.1 Usage Tracker (Test-First)

**Test File**: `src/ai/usage/UsageTracker.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageTracker } from './UsageTracker';

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(async () => {
    const db = await createTestDatabase();
    tracker = new UsageTracker(db);
  });

  describe('Token Tracking', () => {
    it('should_track_tokens_per_request', async () => {
      await tracker.record({
        userId: 'user_1',
        provider: 'openai',
        model: 'gpt-5.2',
        tokensInput: 500,
        tokensOutput: 200,
        latencyMs: 1500
      });

      const usage = await tracker.getUsage('user_1', { period: 'day' });

      expect(usage.totalTokensInput).toBe(500);
      expect(usage.totalTokensOutput).toBe(200);
      expect(usage.requestCount).toBe(1);
    });

    it('should_aggregate_usage_over_time', async () => {
      // Multiple requests
      for (let i = 0; i < 10; i++) {
        await tracker.record({
          userId: 'user_1',
          provider: 'openai',
          model: 'gpt-5.2',
          tokensInput: 100,
          tokensOutput: 50
        });
      }

      const usage = await tracker.getUsage('user_1', { period: 'day' });

      expect(usage.totalTokensInput).toBe(1000);
      expect(usage.totalTokensOutput).toBe(500);
      expect(usage.requestCount).toBe(10);
    });

    it('should_track_by_provider', async () => {
      await tracker.record({
        userId: 'user_1',
        provider: 'openai',
        model: 'gpt-5.2',
        tokensInput: 100,
        tokensOutput: 50
      });

      await tracker.record({
        userId: 'user_1',
        provider: 'anthropic',
        model: 'claude-opus-4.5',
        tokensInput: 200,
        tokensOutput: 100
      });

      const byProvider = await tracker.getUsageByProvider('user_1', { period: 'day' });

      expect(byProvider.openai.totalTokensInput).toBe(100);
      expect(byProvider.anthropic.totalTokensInput).toBe(200);
    });
  });

  describe('Cost Estimation', () => {
    it('should_estimate_cost_for_openai', async () => {
      await tracker.record({
        userId: 'user_1',
        provider: 'openai',
        model: 'gpt-5.2',
        tokensInput: 1000000,  // 1M tokens
        tokensOutput: 500000   // 0.5M tokens
      });

      const usage = await tracker.getUsage('user_1', { period: 'day' });

      // GPT-5.2: ~$15/M input, ~$60/M output
      expect(usage.estimatedCost).toBeGreaterThan(40);
      expect(usage.estimatedCost).toBeLessThan(50);
    });

    it('should_estimate_cost_for_deepseek', async () => {
      await tracker.record({
        userId: 'user_1',
        provider: 'deepseek',
        model: 'deepseek-v3.2',
        tokensInput: 1000000,
        tokensOutput: 500000
      });

      const usage = await tracker.getUsage('user_1', { period: 'day' });

      // DeepSeek: ~$0.55/M input, ~$2.19/M output
      expect(usage.estimatedCost).toBeLessThan(2);
    });

    it('should_report_zero_cost_for_ollama', async () => {
      await tracker.record({
        userId: 'user_1',
        provider: 'ollama',
        model: 'llama3.3',
        tokensInput: 1000000,
        tokensOutput: 500000
      });

      const usage = await tracker.getUsage('user_1', { period: 'day' });

      expect(usage.estimatedCost).toBe(0);
    });
  });

  describe('Alerts & Limits', () => {
    it('should_alert_on_high_usage', async () => {
      const alertHandler = vi.fn();
      tracker.onAlert(alertHandler);

      tracker.setLimit('user_1', {
        dailyCostLimit: 10, // $10/day
        alertThreshold: 0.8 // Alert at 80%
      });

      // Simulate $8 usage
      await tracker.record({
        userId: 'user_1',
        provider: 'openai',
        model: 'gpt-5.2',
        tokensInput: 500000,
        tokensOutput: 100000
      });

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage_threshold',
          percentage: expect.any(Number)
        })
      );
    });

    it('should_block_requests_at_limit', async () => {
      tracker.setLimit('user_1', {
        dailyCostLimit: 1 // $1/day
      });

      // Use up the limit
      await tracker.record({
        userId: 'user_1',
        provider: 'openai',
        model: 'gpt-5.2',
        tokensInput: 100000,
        tokensOutput: 50000
      });

      const canProceed = await tracker.checkLimit('user_1');

      expect(canProceed.allowed).toBe(false);
      expect(canProceed.reason).toContain('limit exceeded');
    });
  });

  describe('Reporting', () => {
    it('should_generate_monthly_report', async () => {
      // Add usage data
      for (let i = 0; i < 30; i++) {
        await tracker.record({
          userId: 'user_1',
          provider: 'openai',
          model: 'gpt-5.2',
          tokensInput: 10000,
          tokensOutput: 5000,
          timestamp: new Date(2024, 11, i + 1)
        });
      }

      const report = await tracker.generateReport('user_1', {
        period: 'month',
        month: 12,
        year: 2024
      });

      expect(report.totalRequests).toBe(30);
      expect(report.totalTokens).toBeGreaterThan(0);
      expect(report.estimatedCost).toBeGreaterThan(0);
      expect(report.byDay).toHaveLength(30);
      expect(report.byProvider).toBeDefined();
    });
  });
});
```

---

## 🔄 Phase 20: Fallback & Reliability

### 20.1 AI Provider Fallback (Test-First)

**Test File**: `src/ai/reliability/ProviderFallback.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFallback } from './ProviderFallback';
import { AIProvider } from '../providers/AIProvider.interface';

describe('ProviderFallback', () => {
  let fallback: ProviderFallback;
  let primaryProvider: AIProvider;
  let backupProvider: AIProvider;

  beforeEach(() => {
    primaryProvider = createMockProvider('openai');
    backupProvider = createMockProvider('anthropic');

    fallback = new ProviderFallback({
      primary: primaryProvider,
      backups: [backupProvider]
    });
  });

  describe('Primary Success', () => {
    it('should_use_primary_when_available', async () => {
      primaryProvider.analyze = vi.fn().mockResolvedValue({
        content: 'Primary result',
        confidence: 0.9
      });

      const result = await fallback.analyze({ prompt: 'Test' });

      expect(result.content).toBe('Primary result');
      expect(primaryProvider.analyze).toHaveBeenCalled();
      expect(backupProvider.analyze).not.toHaveBeenCalled();
    });
  });

  describe('Fallback on Failure', () => {
    it('should_fallback_to_backup_on_primary_failure', async () => {
      primaryProvider.analyze = vi.fn().mockRejectedValue(
        new Error('Primary failed')
      );
      backupProvider.analyze = vi.fn().mockResolvedValue({
        content: 'Backup result',
        confidence: 0.85
      });

      const result = await fallback.analyze({ prompt: 'Test' });

      expect(result.content).toBe('Backup result');
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackProvider).toBe('anthropic');
    });

    it('should_fallback_on_rate_limiting', async () => {
      primaryProvider.analyze = vi.fn().mockRejectedValue({
        status: 429,
        message: 'Rate limited'
      });
      backupProvider.analyze = vi.fn().mockResolvedValue({
        content: 'Backup result',
        confidence: 0.8
      });

      const result = await fallback.analyze({ prompt: 'Test' });

      expect(result.content).toBe('Backup result');
    });

    it('should_fallback_on_timeout', async () => {
      primaryProvider.analyze = vi.fn().mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      );
      backupProvider.analyze = vi.fn().mockResolvedValue({
        content: 'Fast backup',
        confidence: 0.75
      });

      fallback.setTimeout(1000);

      const result = await fallback.analyze({ prompt: 'Test' });

      expect(result.content).toBe('Fast backup');
    });
  });

  describe('Multiple Backups', () => {
    it('should_try_all_backups_in_order', async () => {
      const backup2 = createMockProvider('deepseek');

      fallback = new ProviderFallback({
        primary: primaryProvider,
        backups: [backupProvider, backup2]
      });

      primaryProvider.analyze = vi.fn().mockRejectedValue(new Error('Failed'));
      backupProvider.analyze = vi.fn().mockRejectedValue(new Error('Also failed'));
      backup2.analyze = vi.fn().mockResolvedValue({
        content: 'Third time lucky',
        confidence: 0.7
      });

      const result = await fallback.analyze({ prompt: 'Test' });

      expect(result.content).toBe('Third time lucky');
      expect(result.fallbackProvider).toBe('deepseek');
    });

    it('should_throw_when_all_providers_fail', async () => {
      primaryProvider.analyze = vi.fn().mockRejectedValue(new Error('Failed'));
      backupProvider.analyze = vi.fn().mockRejectedValue(new Error('Also failed'));

      await expect(
        fallback.analyze({ prompt: 'Test' })
      ).rejects.toThrow('All AI providers failed');
    });
  });

  describe('Circuit Breaker', () => {
    it('should_skip_primary_after_repeated_failures', async () => {
      primaryProvider.analyze = vi.fn().mockRejectedValue(new Error('Down'));
      backupProvider.analyze = vi.fn().mockResolvedValue({ content: 'OK' });

      fallback.setCircuitBreakerThreshold(3);

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await fallback.analyze({ prompt: 'Test' });
      }

      // 4th request should skip primary entirely
      primaryProvider.analyze.mockClear();
      await fallback.analyze({ prompt: 'Test' });

      expect(primaryProvider.analyze).not.toHaveBeenCalled();
    });

    it('should_retry_primary_after_cooldown', async () => {
      vi.useFakeTimers();

      primaryProvider.analyze = vi.fn().mockRejectedValue(new Error('Down'));
      backupProvider.analyze = vi.fn().mockResolvedValue({ content: 'OK' });

      fallback.setCircuitBreakerThreshold(3);
      fallback.setCircuitBreakerCooldown(60000); // 1 minute

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        await fallback.analyze({ prompt: 'Test' });
      }

      // Advance time past cooldown
      vi.advanceTimersByTime(61000);

      // Should try primary again
      primaryProvider.analyze = vi.fn().mockResolvedValue({ content: 'Recovered' });
      const result = await fallback.analyze({ prompt: 'Test' });

      expect(primaryProvider.analyze).toHaveBeenCalled();
      expect(result.content).toBe('Recovered');

      vi.useRealTimers();
    });
  });

  describe('Logging', () => {
    it('should_log_fallback_events', async () => {
      const logHandler = vi.fn();
      fallback.onFallback(logHandler);

      primaryProvider.analyze = vi.fn().mockRejectedValue(new Error('Failed'));
      backupProvider.analyze = vi.fn().mockResolvedValue({ content: 'OK' });

      await fallback.analyze({ prompt: 'Test' });

      expect(logHandler).toHaveBeenCalledWith({
        primaryProvider: 'openai',
        fallbackProvider: 'anthropic',
        reason: 'Failed',
        timestamp: expect.any(Date)
      });
    });
  });
});
```

---

## 🎨 User Experience

### AI Connection UI Flow

```
┌────────────────────────────────────────────────────────────────┐
│  CONNECT YOUR AI PROVIDER                                       │
│                                                                  │
│  Your AI, Your API Key, Your Cost                               │
│                                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Choose a provider:                                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ★ RECOMMENDED                                               │ │
│  │                                                              │ │
│  │ ┌─────────┐  OpenAI                                         │ │
│  │ │  GPT    │  GPT-5.2, o3, o4-mini                          │ │
│  │ └─────────┘  Best for: Complex reasoning, market analysis   │ │
│  │              Cost: ~$0.01-0.05 per analysis                  │ │
│  │              [Connect OpenAI]                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────┐  Anthropic                                         │
│  │ Claude  │  Claude Opus 4.5, Claude Sonnet 4                  │
│  └─────────┘  Best for: Nuanced analysis, safety-first          │
│              [Connect Anthropic]                                 │
│                                                                  │
│  ┌─────────┐  Google                                            │
│  │ Gemini  │  Gemini 2.5 Pro/Flash, Gemini 3 Deep Think        │
│  └─────────┘  Best for: Multimodal, fast responses              │
│              [Connect Google]                                    │
│                                                                  │
│  ┌─────────┐  DeepSeek                                          │
│  │   DS    │  V3.2, R1                                          │
│  └─────────┘  Best for: Cost efficiency (~10x cheaper)          │
│              [Connect DeepSeek]                                  │
│                                                                  │
│  ┌─────────┐  xAI                                               │
│  │  Grok   │  Grok 4.1, Grok 4                                  │
│  └─────────┘  Best for: Real-time data, X integration           │
│              [Connect xAI]                                       │
│                                                                  │
│  ┌─────────┐  Groq                                              │
│  │  GROQ   │  Llama 3.3 70B, Mixtral 8x22B                     │
│  └─────────┘  Best for: Ultra-fast, lowest latency              │
│              [Connect Groq]                                      │
│                                                                  │
│  ┌─────────┐  Mistral                                           │
│  │Mistral  │  Mistral Large, Codestral                          │
│  └─────────┘  Best for: EU data residency, coding               │
│              [Connect Mistral]                                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  🏠 LOCAL (No API Costs)                                        │
│                                                                  │
│  ┌─────────┐  Ollama                                            │
│  │ LOCAL   │  Llama 3.3, Qwen 3, Mistral (local)               │
│  └─────────┘  Best for: Privacy, zero API costs                 │
│              Requires: Ollama installed locally                  │
│              [Connect Local Ollama]                              │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Model Selection UI

```
┌────────────────────────────────────────────────────────────────┐
│  OPENAI CONNECTED ✓                        [Switch Provider]   │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Select Model:                                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [★] GPT-5.2 (Latest & Most Capable)                      │   │
│  │     Context: 128K tokens | Vision: ✓ | Streaming: ✓     │   │
│  │     Cost: ~$15/M input, ~$60/M output                     │   │
│  │     Best for: Complex trading decisions                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [ ] o3 (Reasoning Model)                                  │   │
│  │     Context: 128K tokens | Extended Thinking: ✓          │   │
│  │     Cost: Higher (uses reasoning tokens)                  │   │
│  │     Best for: Complex multi-step analysis                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [ ] GPT-4.1 (Balanced)                                    │   │
│  │     Context: 1M tokens | Vision: ✓ | Streaming: ✓        │   │
│  │     Cost: ~$2.50/M input, ~$10/M output                   │   │
│  │     Best for: General analysis, cost-conscious            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ [ ] GPT-4.1-mini (Fast & Cheap)                          │   │
│  │     Context: 1M tokens | Streaming: ✓                     │   │
│  │     Cost: Very low                                        │   │
│  │     Best for: High-frequency, simple decisions            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Monthly Cost Estimate: ~$15-45 based on your usage pattern     │
│                                                                  │
│  [Save & Continue]                                               │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## 📅 Implementation Timeline

```
EXISTING SPRINTS 1-12 (Weeks 1-24)
└── As defined in plans 11 & 12

NEW: SPRINT 13-14: AI Provider Layer (Weeks 25-28)
├── Week 25: AI Provider Interface & Factory
│   ├── Write interface tests
│   ├── Implement AIProvider interface
│   ├── Implement AIProviderFactory
│   └── Write factory tests
│
├── Week 26: Tier 1 Adapters (OpenAI, Anthropic, Google, DeepSeek)
│   ├── OpenAI adapter with GPT-5.2, o3, o4-mini support
│   ├── Anthropic adapter with Opus 4.5, Sonnet 4, Claude 3.7
│   ├── Google adapter with Gemini 2.5 Pro/Flash
│   ├── DeepSeek adapter with V3.2, R1
│   └── Full test coverage for each adapter
│
├── Week 27: AI Key Security & Usage Tracking
│   ├── AI Key Vault implementation
│   ├── Encryption tests (AES-256-GCM)
│   ├── Usage tracker implementation
│   ├── Cost estimation per provider
│   └── Daily/monthly reporting
│
├── Week 28: Fallback & Reliability
│   ├── Provider fallback system
│   ├── Circuit breaker implementation
│   ├── Timeout handling
│   └── Health monitoring

SPRINT 15-16: Tier 2 & 3 Providers (Weeks 29-32)
├── Week 29: Tier 2 Providers
│   ├── xAI (Grok) adapter with Grok 4.1, 4, 3
│   ├── Groq adapter with Llama 3.3, Mixtral
│   ├── Mistral adapter with Large, Codestral
│   └── Test coverage for all Tier 2
│
├── Week 30: Local Providers (Tier 3)
│   ├── Ollama adapter (local inference)
│   ├── LM Studio adapter
│   ├── Model discovery and pulling
│   └── Privacy-first testing
│
├── Week 31: UI Integration
│   ├── "Connect Your AI" UI component
│   ├── Model selection interface
│   ├── Cost estimation display
│   ├── Provider switching
│   └── Usage dashboard
│
└── Week 32: Integration Testing & Polish
    ├── Full E2E tests across all providers
    ├── Performance benchmarking
    ├── Error handling edge cases
    ├── Documentation
    └── User onboarding flow
```

---

## 🎯 Success Metrics

### Phase Completion Criteria

| Phase | Tests | Coverage | Criteria |
|-------|-------|----------|----------|
| Phase 16: AI Provider Interface | 15+ | 95% | All interface methods tested |
| Phase 17: Provider Adapters | 80+ | 90% | All Tier 1 providers working |
| Phase 18: AI Key Security | 25+ | 95% | Encryption verified, no key leaks |
| Phase 19: Usage Tracking | 20+ | 90% | Accurate cost estimation |
| Phase 20: Fallback & Reliability | 20+ | 90% | Circuit breaker working |

### User Experience Goals

- **< 3 minutes**: Time to connect first AI provider
- **< 5 clicks**: Connect provider and select model
- **100% transparency**: Users always see estimated costs BEFORE actions
- **Zero surprise bills**: Daily usage alerts at 80% of limit

### Technical KPIs

| Metric | Target |
|--------|--------|
| Provider connection success rate | > 99% |
| Fallback activation when needed | 100% |
| Cost estimation accuracy | ± 10% |
| Key encryption strength | AES-256-GCM |
| Provider switch time | < 500ms |

---

## 📊 Cost Comparison Reference

### Per 1,000 Trading Analyses (~500 tokens input, ~200 tokens output each)

| Provider | Model | Estimated Cost |
|----------|-------|----------------|
| DeepSeek | V3.2 | ~$0.15 |
| Groq | Llama 3.3 70B | ~$0.10 |
| Google | Gemini 2.5 Flash | ~$0.50 |
| OpenAI | GPT-4.1-mini | ~$0.75 |
| Google | Gemini 2.5 Pro | ~$2.00 |
| OpenAI | GPT-5.2 | ~$4.50 |
| Anthropic | Claude Sonnet 4 | ~$5.00 |
| Anthropic | Claude Opus 4.5 | ~$12.00 |
| OpenAI | o3 (reasoning) | ~$15.00+ |
| Ollama | Any local | $0.00 |

### Recommended Configurations

**Budget Conscious** (< $5/month):
- Primary: DeepSeek V3.2
- Backup: Ollama (local)

**Balanced** (~$20/month):
- Primary: GPT-4.1
- Backup: DeepSeek V3.2

**Maximum Accuracy** (~$50+/month):
- Primary: Claude Opus 4.5 or GPT-5.2
- Backup: Gemini 2.5 Pro

**Privacy First** ($0 API cost):
- Primary: Ollama with Llama 3.3
- Backup: Ollama with Qwen 3

---

## 🔗 Integration with Existing Plans

This plan extends:
- **Plan 11**: Multi-User Platform TDD - adds AI provider per user
- **Plan 12**: Enhanced Security - adds AI key security alongside exchange key security

### Database Schema Additions

```sql
-- Add to existing user schema
CREATE TABLE user_ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    selected_model VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    tokens_input INTEGER NOT NULL,
    tokens_output INTEGER NOT NULL,
    tokens_reasoning INTEGER DEFAULT 0,
    latency_ms INTEGER,
    estimated_cost DECIMAL(10, 6),
    request_type VARCHAR(50), -- 'analysis', 'signal', 'sentiment', etc.
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_usage_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    daily_cost_limit DECIMAL(10, 2),
    monthly_cost_limit DECIMAL(10, 2),
    alert_threshold DECIMAL(3, 2) DEFAULT 0.80,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at);
CREATE INDEX idx_ai_usage_provider ON ai_usage_logs(provider);
```

---

## 🎉 Summary

This plan adds **user-selectable AI providers** to Neural Trading, maintaining the philosophy:

> **"Your AI, Your API Key, Your Cost"**

Just like users connect their own exchange accounts, they now connect their own AI providers.

**Key Benefits:**
1. **No AI costs for platform owner** - users pay their own AI bills
2. **User choice** - from DeepSeek ($0.15/1K analyses) to Claude Opus ($12/1K)
3. **Privacy option** - local Ollama for zero-cost, private inference
4. **Reliability** - automatic fallback between providers
5. **Transparency** - real-time cost tracking and alerts

**Test Count**: 160+ new tests across 5 phases
**Timeline**: 8 additional weeks (Weeks 25-32)
**Rating Target**: 95/100 with this addition