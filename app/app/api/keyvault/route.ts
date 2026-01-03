/**
 * KeyVault API Route - Phase 18: AI Key Security
 * Next.js API route for secure API key management
 *
 * Endpoints:
 * - GET /api/keyvault - List user's encrypted keys
 * - POST /api/keyvault - Store a new encrypted key
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { encryptApiKey, maskApiKey } from '@/lib/encryption';
import db from '@/lib/db';

// ============================================================================
// GET /api/keyvault - List Keys
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyType = searchParams.get('keyType') || undefined;
    const providerId = searchParams.get('providerId') || undefined;

    const keys = await db.apiKeys.findByUserId(userId, { keyType, providerId });

    // Map to frontend-friendly format with masked keys
    const mappedKeys = keys.map((key) => ({
      id: key.id,
      keyType: key.keyType,
      providerId: key.providerId,
      keyVersion: key.keyVersion,
      maskedKey: '****...****',
      metadata: key.metadata,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: mappedKeys,
    });
  } catch (error: any) {
    console.error('KeyVault list error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list keys' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/keyvault - Store Key
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { keyType, providerId, key, metadata } = body;

    // Validate required fields
    if (!keyType || !providerId || !key) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: keyType, providerId, key' },
        { status: 400 }
      );
    }

    // Validate keyType
    const validKeyTypes = ['ai_provider', 'exchange', 'webhook', 'other'];
    if (!validKeyTypes.includes(keyType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid key type' },
        { status: 400 }
      );
    }

    // Encrypt the key
    const encryptedKey = encryptApiKey(key);

    // Create or update key
    const storedKey = await db.apiKeys.create({
      userId,
      keyType,
      providerId,
      encryptedKey,
      metadata,
    });

    if (!storedKey) {
      return NextResponse.json(
        { success: false, error: 'Failed to store key' },
        { status: 500 }
      );
    }

    // Log audit event
    await db.auditLogs.create({
      userId,
      keyId: storedKey.id,
      action: 'key_stored',
      details: { keyType, providerId, keyVersion: storedKey.keyVersion },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: storedKey.id,
        keyType: storedKey.keyType,
        providerId: storedKey.providerId,
        keyVersion: storedKey.keyVersion,
        maskedKey: maskApiKey(key),
        metadata: storedKey.metadata,
        createdAt: storedKey.createdAt,
        updatedAt: storedKey.updatedAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('KeyVault store error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to store key' },
      { status: 500 }
    );
  }
}
