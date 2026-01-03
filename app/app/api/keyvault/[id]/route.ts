/**
 * KeyVault API Route - Phase 18: AI Key Security
 * Dynamic route for single key operations
 *
 * Endpoints:
 * - GET /api/keyvault/[id] - Retrieve decrypted key
 * - DELETE /api/keyvault/[id] - Delete key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { decryptApiKey } from '@/lib/encryption';
import db from '@/lib/db';

// ============================================================================
// GET /api/keyvault/[id] - Retrieve Key
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
        details: { attemptedBy: userId, keyOwner: key.userId },
      });
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Decrypt the key
    const plaintext = decryptApiKey(key.encryptedKey);

    // Log retrieval
    await db.auditLogs.create({
      userId,
      keyId: id,
      action: 'key_retrieved',
      details: { keyType: key.keyType, providerId: key.providerId },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: key.id,
        keyType: key.keyType,
        providerId: key.providerId,
        plaintext,
        keyVersion: key.keyVersion,
        metadata: key.metadata,
      },
    });
  } catch (error: any) {
    console.error('KeyVault retrieve error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve key' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/keyvault/[id] - Delete Key
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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
        details: { action: 'delete', attemptedBy: userId },
      });
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Delete the key
    await db.apiKeys.delete(id);

    // Log deletion
    await db.auditLogs.create({
      userId,
      keyId: id,
      action: 'key_deleted',
      details: { keyType: key.keyType, providerId: key.providerId, keyVersion: key.keyVersion },
    });

    return NextResponse.json({
      success: true,
      message: 'Key deleted successfully',
    });
  } catch (error: any) {
    console.error('KeyVault delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete key' },
      { status: 500 }
    );
  }
}
