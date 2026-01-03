/**
 * KeyVault API Route - Phase 18: AI Key Security
 * Key rotation endpoint
 *
 * Endpoints:
 * - POST /api/keyvault/[id]/rotate - Rotate key to new value
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { encryptApiKey, maskApiKey } from '@/lib/encryption';
import db from '@/lib/db';

// ============================================================================
// POST /api/keyvault/[id]/rotate - Rotate Key
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { newKey } = body;

    if (!newKey) {
      return NextResponse.json(
        { success: false, error: 'New API key is required' },
        { status: 400 }
      );
    }

    // Check if key exists
    const key = await db.apiKeys.findById(id);

    if (!key) {
      return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 });
    }

    // Check ownership
    if (key.userId !== userId) {
      // Log access denial
      await db.auditLogs.create({
        userId,
        keyId: id,
        action: 'access_denied',
        details: { action: 'rotate', attemptedBy: userId },
      });
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Encrypt new key
    const encryptedKey = encryptApiKey(newKey);

    // Update the key (which will increment version)
    const rotatedKey = await db.apiKeys.update(id, { encryptedKey });

    if (!rotatedKey) {
      return NextResponse.json(
        { success: false, error: 'Failed to rotate key' },
        { status: 500 }
      );
    }

    // Log rotation
    await db.auditLogs.create({
      userId,
      keyId: id,
      action: 'key_rotated',
      details: {
        oldVersion: key.keyVersion,
        newVersion: rotatedKey.keyVersion,
        keyType: key.keyType,
        providerId: key.providerId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: rotatedKey.id,
        keyType: rotatedKey.keyType,
        providerId: rotatedKey.providerId,
        keyVersion: rotatedKey.keyVersion,
        maskedKey: maskApiKey(newKey),
        updatedAt: rotatedKey.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('KeyVault rotate error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to rotate key' },
      { status: 500 }
    );
  }
}
