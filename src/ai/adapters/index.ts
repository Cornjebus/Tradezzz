/**
 * AI Adapter Factory - Creates the right adapter for each provider
 */

import { AIAdapter, AIAdapterConfig } from './types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { DeepSeekAdapter } from './DeepSeekAdapter';
import { OllamaAdapter } from './OllamaAdapter';
import { GrokAdapter } from './GrokAdapter';
import { GoogleAdapter } from './GoogleAdapter';
import { CohereAdapter } from './CohereAdapter';
import { MistralAdapter } from './MistralAdapter';

export type SupportedProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'ollama'
  | 'grok'
  | 'google'
  | 'cohere'
  | 'mistral';

export interface AdapterFactoryConfig extends AIAdapterConfig {
  provider: SupportedProvider;
}

/**
 * Create an AI adapter for the specified provider
 */
export function createAdapter(config: AdapterFactoryConfig): AIAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'deepseek':
      return new DeepSeekAdapter(config);
    case 'ollama':
      return new OllamaAdapter(config);
    case 'grok':
      return new GrokAdapter(config);
    case 'google':
      return new GoogleAdapter(config);
    case 'cohere':
      return new CohereAdapter(config);
    case 'mistral':
      return new MistralAdapter(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Get provider info for display
 */
export const PROVIDER_INFO: Record<SupportedProvider, {
  name: string;
  description: string;
  features: string[];
  requiresApiKey: boolean;
  defaultModel: string;
  pricing: string;
}> = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o and GPT-4 models',
    features: ['chat', 'vision', 'function_calling', 'streaming'],
    requiresApiKey: true,
    defaultModel: 'gpt-4o-mini',
    pricing: '$0.00015-$0.03/1K tokens',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet and Claude 3 models',
    features: ['chat', 'vision', 'function_calling', 'long_context'],
    requiresApiKey: true,
    defaultModel: 'claude-3-5-sonnet-20241022',
    pricing: '$0.00025-$0.015/1K tokens',
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'Cost-efficient AI with OpenAI-compatible API',
    features: ['chat', 'function_calling', 'code_generation'],
    requiresApiKey: true,
    defaultModel: 'deepseek-chat',
    pricing: '$0.0001/1K tokens (100x cheaper)',
  },
  ollama: {
    name: 'Ollama',
    description: 'Local AI models with no API costs',
    features: ['chat', 'streaming', 'privacy', 'offline'],
    requiresApiKey: false,
    defaultModel: 'llama3.2',
    pricing: 'Free (local)',
  },
  grok: {
    name: 'Grok (xAI)',
    description: 'Reasoning-focused Grok 2 models from xAI',
    features: ['chat', 'reasoning', 'code'],
    requiresApiKey: true,
    defaultModel: 'grok-2',
    pricing: 'Approx. $0.00025-$0.001/1K tokens (subject to change)',
  },
  google: {
    name: 'Google Gemini',
    description: 'Gemini Pro and Gemini 1.5 models',
    features: ['chat', 'vision', 'function_calling', 'streaming'],
    requiresApiKey: true,
    defaultModel: 'gemini-pro',
    pricing: '$1.25-$7/1M input, $5-$21/1M output (approx)',
  },
  cohere: {
    name: 'Cohere',
    description: 'Enterprise AI with Command R models and RAG',
    features: ['chat', 'function_calling', 'rag', 'embeddings'],
    requiresApiKey: true,
    defaultModel: 'command-r',
    pricing: '$0.5-$15/1M tokens',
  },
  mistral: {
    name: 'Mistral AI',
    description: 'European AI with efficient Mistral and Mixtral models',
    features: ['chat', 'function_calling', 'code', 'streaming'],
    requiresApiKey: true,
    defaultModel: 'mistral-small-latest',
    pricing: '$0.25-$8/1M tokens',
  },
};

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): SupportedProvider[] {
  return Object.keys(PROVIDER_INFO) as SupportedProvider[];
}

// Re-export types and adapters
export * from './types';
export { OpenAIAdapter } from './OpenAIAdapter';
export { AnthropicAdapter } from './AnthropicAdapter';
export { DeepSeekAdapter } from './DeepSeekAdapter';
export { OllamaAdapter } from './OllamaAdapter';
export { GrokAdapter } from './GrokAdapter';
export { GoogleAdapter } from './GoogleAdapter';
export { CohereAdapter } from './CohereAdapter';
export { MistralAdapter } from './MistralAdapter';
