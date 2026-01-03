/**
 * Usage History API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

// GET /api/usage/history - Get usage history with filtering
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || undefined;
    const model = searchParams.get('model') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const records = await db.usageRecords.findByUserId(userId, startDate, endDate);

    // Filter by provider and model
    let filtered = records;
    if (provider) {
      filtered = filtered.filter(r => r.provider === provider);
    }
    if (model) {
      filtered = filtered.filter(r => r.model === model);
    }

    // Sort by date descending and paginate
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
      },
    });
  } catch (error) {
    console.error('Get usage history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
