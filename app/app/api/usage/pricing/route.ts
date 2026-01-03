/**
 * Pricing API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Provider pricing (per 1M tokens)
const PROVIDER_PRICING: Record<string, { provider: string; models: Record<string, { inputPricePerMillion: number; outputPricePerMillion: number }>; isLocal?: boolean }> = {
  openai: {
    provider: 'openai',
    models: {
      'gpt-4': { inputPricePerMillion: 30.00, outputPricePerMillion: 60.00 },
      'gpt-4-turbo': { inputPricePerMillion: 10.00, outputPricePerMillion: 30.00 },
      'gpt-4o': { inputPricePerMillion: 5.00, outputPricePerMillion: 15.00 },
      'gpt-4o-mini': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
      'gpt-3.5-turbo': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'text-embedding-ada-002': { inputPricePerMillion: 0.10, outputPricePerMillion: 0 },
      'text-embedding-3-small': { inputPricePerMillion: 0.02, outputPricePerMillion: 0 },
      'text-embedding-3-large': { inputPricePerMillion: 0.13, outputPricePerMillion: 0 },
    },
  },
  anthropic: {
    provider: 'anthropic',
    models: {
      'claude-3-opus': { inputPricePerMillion: 15.00, outputPricePerMillion: 75.00 },
      'claude-3-sonnet': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
      'claude-3-haiku': { inputPricePerMillion: 0.25, outputPricePerMillion: 1.25 },
      'claude-3.5-sonnet': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
    },
  },
  deepseek: {
    provider: 'deepseek',
    models: {
      'deepseek-chat': { inputPricePerMillion: 0.14, outputPricePerMillion: 0.28 },
      'deepseek-coder': { inputPricePerMillion: 0.14, outputPricePerMillion: 0.28 },
      'deepseek-reasoner': { inputPricePerMillion: 0.55, outputPricePerMillion: 2.19 },
    },
  },
  google: {
    provider: 'google',
    models: {
      'gemini-pro': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'gemini-pro-vision': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'gemini-1.5-pro': { inputPricePerMillion: 3.50, outputPricePerMillion: 10.50 },
      'gemini-1.5-flash': { inputPricePerMillion: 0.075, outputPricePerMillion: 0.30 },
    },
  },
  mistral: {
    provider: 'mistral',
    models: {
      'mistral-tiny': { inputPricePerMillion: 0.25, outputPricePerMillion: 0.25 },
      'mistral-small': { inputPricePerMillion: 1.00, outputPricePerMillion: 3.00 },
      'mistral-medium': { inputPricePerMillion: 2.70, outputPricePerMillion: 8.10 },
      'mistral-large': { inputPricePerMillion: 4.00, outputPricePerMillion: 12.00 },
    },
  },
  cohere: {
    provider: 'cohere',
    models: {
      'command': { inputPricePerMillion: 1.00, outputPricePerMillion: 2.00 },
      'command-light': { inputPricePerMillion: 0.30, outputPricePerMillion: 0.60 },
      'command-r': { inputPricePerMillion: 0.50, outputPricePerMillion: 1.50 },
      'command-r-plus': { inputPricePerMillion: 3.00, outputPricePerMillion: 15.00 },
    },
  },
  grok: {
    provider: 'grok',
    models: {
      'grok-1': { inputPricePerMillion: 5.00, outputPricePerMillion: 15.00 },
      'grok-2': { inputPricePerMillion: 2.00, outputPricePerMillion: 10.00 },
    },
  },
  ollama: {
    provider: 'ollama',
    models: {},
    isLocal: true,
  },
};

// GET /api/usage/pricing - Get all pricing
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: PROVIDER_PRICING,
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
