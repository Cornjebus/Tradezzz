/**
 * Usage API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

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
  },
  google: {
    'gemini-pro': { input: 0.50, output: 1.50 },
    'gemini-1.5-pro': { input: 3.50, output: 10.50 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  },
};

function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number) {
  const pricing = PROVIDER_PRICING[provider]?.[model];
  if (!pricing) {
    return { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD', isLocal: true };
  }
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: 'USD',
    isLocal: false,
  };
}

// POST /api/usage - Track token usage
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { providerId, provider, model, inputTokens, outputTokens, operation, latencyMs, metadata } = body;

    if (!providerId || !provider || !model || inputTokens === undefined || outputTokens === undefined || !operation) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const totalTokens = inputTokens + outputTokens;
    const cost = estimateCost(provider, model, inputTokens, outputTokens);

    const record = await db.usageRecords.create({
      userId,
      providerId,
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      operation,
      estimatedCost: cost.totalCost,
      latencyMs,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: record,
    }, { status: 201 });
  } catch (error) {
    console.error('Track usage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/usage - Get usage summary
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'daily' | 'weekly' | 'monthly') || 'daily';

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const records = await db.usageRecords.findByUserId(userId, startDate, now);

    let totalTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const byProvider: Record<string, any> = {};

    for (const record of records) {
      totalTokens += record.totalTokens;
      totalInputTokens += record.inputTokens;
      totalOutputTokens += record.outputTokens;
      totalCost += record.estimatedCost;

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }

      if (!byProvider[record.provider]) {
        byProvider[record.provider] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          byModel: {},
        };
      }

      byProvider[record.provider].totalTokens += record.totalTokens;
      byProvider[record.provider].totalRequests++;
      byProvider[record.provider].totalCost += record.estimatedCost;

      if (!byProvider[record.provider].byModel[record.model]) {
        byProvider[record.provider].byModel[record.model] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
        };
      }

      byProvider[record.provider].byModel[record.model].totalTokens += record.totalTokens;
      byProvider[record.provider].byModel[record.model].totalRequests++;
      byProvider[record.provider].byModel[record.model].totalCost += record.estimatedCost;
    }

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalRequests: records.length,
        totalCost,
        averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
        byProvider,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get usage summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
