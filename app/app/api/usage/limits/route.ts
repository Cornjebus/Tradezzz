/**
 * Usage Limits API Routes - Next.js
 * Phase 19: Usage Tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

// Default limits
const DEFAULT_LIMITS = {
  dailyTokenLimit: 100000,
  dailyCostLimit: 10.00,
  monthlyTokenLimit: 1000000,
  monthlyCostLimit: 100.00,
};

// PUT /api/usage/limits - Set usage limits
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dailyTokenLimit, dailyCostLimit, monthlyTokenLimit, monthlyCostLimit } = body;

    await db.usageLimits.upsert(userId, {
      dailyTokenLimit: dailyTokenLimit ?? DEFAULT_LIMITS.dailyTokenLimit,
      dailyCostLimit: dailyCostLimit ?? DEFAULT_LIMITS.dailyCostLimit,
      monthlyTokenLimit: monthlyTokenLimit ?? DEFAULT_LIMITS.monthlyTokenLimit,
      monthlyCostLimit: monthlyCostLimit ?? DEFAULT_LIMITS.monthlyCostLimit,
    });

    return NextResponse.json({
      success: true,
      message: 'Usage limits updated',
    });
  } catch (error) {
    console.error('Set usage limits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/usage/limits - Get current limits
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limits = await db.usageLimits.findByUserId(userId) || DEFAULT_LIMITS;

    return NextResponse.json({
      success: true,
      data: limits,
    });
  } catch (error) {
    console.error('Get usage limits error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
