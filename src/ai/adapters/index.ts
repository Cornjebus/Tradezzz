/**
 * AI Adapter Factory - Creates the right adapter for each provider
 */

import { AIAdapter, AIAdapterConfig } from './types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { DeepSeekAdapter } from './DeepSeekAdapter';
import { OllamaAdapter } from './OllamaAdapter';

export type SupportedProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama';

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
