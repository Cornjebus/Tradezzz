/**
 * Provider Usage API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

// GET /api/usage/providers/[id] - Get usage for specific provider
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: providerId } = await params;
    const records = await db.usageRecords.findByProviderId(userId, providerId);

    let totalTokens = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const byModel: Record<string, any> = {};

    for (const record of records) {
      totalTokens += record.totalTokens;
      totalCost += record.estimatedCost;

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }

      if (!byModel[record.model]) {
        byModel[record.model] = {
          totalTokens: 0,
          totalRequests: 0,
          totalCost: 0,
          averageLatency: 0,
        };
      }

      byModel[record.model].totalTokens += record.totalTokens;
      byModel[record.model].totalRequests++;
      byModel[record.model].totalCost += record.estimatedCost;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalTokens,
        totalRequests: records.length,
        totalCost,
        averageLatency: latencyCount > 0 ? totalLatency / latencyCount : 0,
        byModel,
      },
    });
  } catch (error) {
    console.error('Get provider usage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
