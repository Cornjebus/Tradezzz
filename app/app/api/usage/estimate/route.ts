/**
 * Cost Estimation API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Provider pricing (per 1M tokens)
const PROVIDER_PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  },
  anthropic: {
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  },
  deepseek: {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-coder': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
  },
  google: {
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  },
  mistral: {
    'mistral-tiny': { input: 0.25, output: 0.25 },
    'mistral-small': { input: 1.00, output: 3.00 },
    'mistral-medium': { input: 2.70, output: 8.10 },
    'mistral-large': { input: 4.00, output: 12.00 },
  },
  cohere: {
    'command': { input: 1.00, output: 2.00 },
    'command-light': { input: 0.30, output: 0.60 },
    'command-r': { input: 0.50, output: 1.50 },
    'command-r-plus': { input: 3.00, output: 15.00 },
  },
  grok: {
    'grok-1': { input: 5.00, output: 15.00 },
    'grok-2': { input: 2.00, output: 10.00 },
  },
};

// POST /api/usage/estimate - Estimate cost for tokens
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, model, inputTokens, outputTokens } = body;

    if (!provider || !model || inputTokens === undefined || outputTokens === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const pricing = PROVIDER_PRICING[provider]?.[model];

    if (!pricing) {
      // Check for partial match or return zero for local
      if (provider === 'ollama') {
        return NextResponse.json({
          success: true,
          data: {
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
            currency: 'USD',
            isLocal: true,
          },
        });
      }

      // Try to find partial match
      const providerPricing = PROVIDER_PRICING[provider];
      if (providerPricing) {
        for (const [key, p] of Object.entries(providerPricing)) {
          if (model.includes(key) || key.includes(model)) {
            const inputCost = (inputTokens / 1_000_000) * p.input;
            const outputCost = (outputTokens / 1_000_000) * p.output;
            return NextResponse.json({
              success: true,
              data: {
                inputCost,
                outputCost,
                totalCost: inputCost + outputCost,
                currency: 'USD',
                isLocal: false,
              },
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          currency: 'USD',
          isLocal: false,
          warning: 'Model pricing not found',
        },
      });
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return NextResponse.json({
      success: true,
      data: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        currency: 'USD',
        isLocal: false,
      },
    });
  } catch (error) {
    console.error('Estimate cost error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
