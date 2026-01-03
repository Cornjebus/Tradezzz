/**
 * Usage Limits Check API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

// Default limits
const DEFAULT_LIMITS = {
  dailyTokenLimit: 100000,
  dailyCostLimit: 10.00,
};

// GET /api/usage/limits/check - Check if user is within limits
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user limits
    const limits = await db.usageLimits.findByUserId(userId) || DEFAULT_LIMITS;

    // Get today's usage
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const records = await db.usageRecords.findByUserId(userId, startOfDay, now);

    // Calculate totals
    let totalTokens = 0;
    let totalCost = 0;

    for (const record of records) {
      totalTokens += record.totalTokens;
      totalCost += record.estimatedCost;
    }

    const exceededTokenLimit = totalTokens > limits.dailyTokenLimit;
    const exceededCostLimit = totalCost > limits.dailyCostLimit;
    const tokenLimitUsedPercent = (totalTokens / limits.dailyTokenLimit) * 100;
    const costLimitUsedPercent = (totalCost / limits.dailyCostLimit) * 100;

    return NextResponse.json({
      success: true,
      data: {
        exceededTokenLimit,
        exceededCostLimit,
        tokenLimitUsedPercent: Math.min(tokenLimitUsedPercent, 100),
        costLimitUsedPercent: Math.min(costLimitUsedPercent, 100),
        currentTokens: totalTokens,
        currentCost: totalCost,
        tokenLimit: limits.dailyTokenLimit,
        costLimit: limits.dailyCostLimit,
        withinLimits: !exceededTokenLimit && !exceededCostLimit,
      },
    });
  } catch (error) {
    console.error('Check usage limits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
