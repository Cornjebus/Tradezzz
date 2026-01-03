/**
 * KeyVault Audit API Route - Phase 18: AI Key Security
 * Audit log access endpoint
 *
 * Endpoints:
 * - GET /api/keyvault/audit - Get audit logs for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';

// ============================================================================
// GET /api/keyvault/audit - Get Audit Logs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const logs = await db.auditLogs.findByUserId(userId, { limit, offset });

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('KeyVault audit error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get audit logs' },
      { status: 500 }
    );
  }
}
