/**
 * KeyVault Service - Phase 18: AI Key Security
 *
 * Secure storage and management of API keys with:
 * - AES-256-GCM encryption
 * - Key versioning for rotation
 * - Audit logging for compliance
 * - Access control per user
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type KeyType = 'ai_provider' | 'exchange' | 'webhook' | 'other';

export type AuditAction =
  | 'key_stored'
  | 'key_retrieved'
  | 'key_rotated'
  | 'key_deleted'
  | 'access_denied';

export interface StoredKey {
  id: string;
  userId: string;
  keyType: KeyType;
  providerId: string;
  encryptedKey: string;
  keyVersion: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreKeyInput {
  userId: string;
  keyType: KeyType;
  providerId: string;
  plaintext: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievedKey {
  id: string;
  keyType: KeyType;
  providerId: string;
  plaintext: string;
  keyVersion: number;
  metadata?: Record<string, unknown>;
}

export interface KeyListItem {
  id: string;
  keyType: KeyType;
  providerId: string;
  keyVersion: number;
  maskedKey: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  keyId: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Date;
}

export interface KeyVaultConfig {
  db: any;
  encryptionKey?: string;
}

export interface ListKeysOptions {
  keyType?: KeyType;
  providerId?: string;
}

// ============================================================================
// Encryption Helpers
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(customKey?: string): Buffer {
  const key = customKey || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is required');
  }
  return scryptSync(key, 'keyvault-salt', KEY_LENGTH);
}

function encrypt(plaintext: string, encryptionKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);

  return combined.toString('base64');
}

function decrypt(encryptedBase64: string, encryptionKey: Buffer): string {
  const combined = Buffer.from(encryptedBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// KeyVault Service Implementation
// ============================================================================

export class KeyVaultService {
  private db: any;
  private encryptionKey: Buffer;
  private keys: Map<string, StoredKey> = new Map();
  private auditLogs: AuditLog[] = [];

  constructor(config: KeyVaultConfig) {
    this.db = config.db;
    this.encryptionKey = getEncryptionKey(config.encryptionKey);
  }

  // ============================================================================
  // Key Storage
  // ============================================================================

  async storeKey(input: StoreKeyInput): Promise<StoredKey> {
    const { userId, keyType, providerId, plaintext, metadata } = input;

    // Check if key already exists for this provider
    const existingKey = this.findExistingKey(userId, keyType, providerId);
    const keyVersion = existingKey ? existingKey.keyVersion + 1 : 1;

    // Encrypt the key
    const encryptedKey = encrypt(plaintext, this.encryptionKey);

    const storedKey: StoredKey = {
      id: existingKey?.id || uuidv4(),
      userId,
      keyType,
      providerId,
      encryptedKey,
      keyVersion,
      metadata,
      createdAt: existingKey?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Store in memory (in production, this would go to database)
    this.keys.set(storedKey.id, storedKey);

    // Log audit event
    await this.logAudit(userId, storedKey.id, 'key_stored', {
      keyType,
      providerId,
      keyVersion,
    });

    return storedKey;
  }

  // ============================================================================
  // Key Retrieval
  // ============================================================================

  async retrieveKey(keyId: string, userId: string): Promise<RetrievedKey> {
    const storedKey = this.keys.get(keyId);

    if (!storedKey) {
      throw new Error('Key not found');
    }

    if (storedKey.userId !== userId) {
      await this.logAudit(userId, keyId, 'access_denied', {
        attemptedBy: userId,
        keyOwner: storedKey.userId,
      });
      throw new Error('Access denied');
    }

    // Decrypt the key
    const plaintext = decrypt(storedKey.encryptedKey, this.encryptionKey);

    // Log retrieval
    await this.logAudit(userId, keyId, 'key_retrieved', {
      keyType: storedKey.keyType,
      providerId: storedKey.providerId,
    });

    return {
      id: storedKey.id,
      keyType: storedKey.keyType,
      providerId: storedKey.providerId,
      plaintext,
      keyVersion: storedKey.keyVersion,
      metadata: storedKey.metadata,
    };
  }

  // ============================================================================
  // Key Rotation
  // ============================================================================

  async rotateKey(keyId: string, userId: string, newPlaintext: string): Promise<StoredKey> {
    const storedKey = this.keys.get(keyId);

    if (!storedKey) {
      throw new Error('Key not found');
    }

    if (storedKey.userId !== userId) {
      await this.logAudit(userId, keyId, 'access_denied', {
        action: 'rotate',
        attemptedBy: userId,
      });
      throw new Error('Access denied');
    }

    // Encrypt new key
    const encryptedKey = encrypt(newPlaintext, this.encryptionKey);

    const rotatedKey: StoredKey = {
      ...storedKey,
      encryptedKey,
      keyVersion: storedKey.keyVersion + 1,
      updatedAt: new Date(),
    };

    this.keys.set(keyId, rotatedKey);

    // Log rotation
    await this.logAudit(userId, keyId, 'key_rotated', {
      oldVersion: storedKey.keyVersion,
      newVersion: rotatedKey.keyVersion,
      keyType: storedKey.keyType,
      providerId: storedKey.providerId,
    });

    return rotatedKey;
  }

  // ============================================================================
  // Key Deletion
  // ============================================================================

  async deleteKey(keyId: string, userId: string): Promise<void> {
    const storedKey = this.keys.get(keyId);

    if (!storedKey) {
      throw new Error('Key not found');
    }

    if (storedKey.userId !== userId) {
      await this.logAudit(userId, keyId, 'access_denied', {
        action: 'delete',
        attemptedBy: userId,
      });
      throw new Error('Access denied');
    }

    this.keys.delete(keyId);

    // Log deletion
    await this.logAudit(userId, keyId, 'key_deleted', {
      keyType: storedKey.keyType,
      providerId: storedKey.providerId,
      keyVersion: storedKey.keyVersion,
    });
  }

  // ============================================================================
  // List Keys
  // ============================================================================

  async listKeys(userId: string, options?: ListKeysOptions): Promise<KeyListItem[]> {
    const userKeys: KeyListItem[] = [];

    for (const [, storedKey] of this.keys) {
      if (storedKey.userId !== userId) continue;

      // Apply filters
      if (options?.keyType && storedKey.keyType !== options.keyType) continue;
      if (options?.providerId && storedKey.providerId !== options.providerId) continue;

      // Decrypt and mask for display
      const plaintext = decrypt(storedKey.encryptedKey, this.encryptionKey);
      const maskedKey = this.maskKey(plaintext);

      userKeys.push({
        id: storedKey.id,
        keyType: storedKey.keyType,
        providerId: storedKey.providerId,
        keyVersion: storedKey.keyVersion,
        maskedKey,
        metadata: storedKey.metadata,
        createdAt: storedKey.createdAt,
        updatedAt: storedKey.updatedAt,
      });
    }

    return userKeys;
  }

  // ============================================================================
  // Audit Logs
  // ============================================================================

  async getAuditLogs(userId: string): Promise<AuditLog[]> {
    return this.auditLogs.filter(log => log.userId === userId);
  }

  private async logAudit(
    userId: string,
    keyId: string,
    action: AuditAction,
    details?: Record<string, unknown>
  ): Promise<void> {
    const log: AuditLog = {
      id: uuidv4(),
      userId,
      keyId,
      action,
      details,
      timestamp: new Date(),
    };

    this.auditLogs.push(log);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private findExistingKey(userId: string, keyType: KeyType, providerId: string): StoredKey | undefined {
    for (const [, key] of this.keys) {
      if (key.userId === userId && key.keyType === keyType && key.providerId === providerId) {
        return key;
      }
    }
    return undefined;
  }

  maskKey(key: string): string {
    if (key.length <= 8) {
      return '****';
    }
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  // ============================================================================
  // Bulk Operations (for key rotation across all users)
  // ============================================================================

  async rotateAllKeys(newEncryptionKey: string): Promise<{ rotated: number; failed: number }> {
    const newKey = getEncryptionKey(newEncryptionKey);
    let rotated = 0;
    let failed = 0;

    for (const [id, storedKey] of this.keys) {
      try {
        // Decrypt with old key
        const plaintext = decrypt(storedKey.encryptedKey, this.encryptionKey);

        // Re-encrypt with new key
        const newEncrypted = encrypt(plaintext, newKey);

        // Update stored key
        storedKey.encryptedKey = newEncrypted;
        storedKey.keyVersion++;
        storedKey.updatedAt = new Date();

        this.keys.set(id, storedKey);
        rotated++;
      } catch (error) {
        failed++;
      }
    }

    // Update encryption key for future operations
    this.encryptionKey = newKey;

    return { rotated, failed };
  }
}
