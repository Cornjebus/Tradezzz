/**
 * KeyVault Service Tests - Phase 18: AI Key Security
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeyVaultService, KeyType, AuditAction } from './KeyVaultService';
import { createMockDatabase, MockDatabase } from '../../tests/helpers/mock-db';

describe('KeyVaultService', () => {
  let keyVault: KeyVaultService;
  let db: MockDatabase;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-ok!');
    db = createMockDatabase();
    keyVault = new KeyVaultService({ db });
  });

  // ============================================================================
  // Key Storage Tests
  // ============================================================================

  describe('storeKey', () => {
    it('should_encrypt_and_store_api_key', async () => {
      const result = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-test-key-12345',
      });

      expect(result.id).toBeDefined();
      expect(result.keyVersion).toBe(1);
      expect(result.keyType).toBe('ai_provider');
      expect(result.providerId).toBe('openai');
      expect(result.encryptedKey).toBeDefined();
      expect(result.encryptedKey).not.toBe('sk-test-key-12345'); // Should be encrypted
    });

    it('should_store_exchange_api_key', async () => {
      const result = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'exchange',
        providerId: 'binance',
        plaintext: 'api-key-binance',
        metadata: { isTestnet: true },
      });

      expect(result.keyType).toBe('exchange');
      expect(result.providerId).toBe('binance');
    });

    it('should_increment_key_version_on_update', async () => {
      // Store initial key
      const first = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'anthropic',
        plaintext: 'key-v1',
      });

      expect(first.keyVersion).toBe(1);

      // Update with new key
      const second = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'anthropic',
        plaintext: 'key-v2',
      });

      expect(second.keyVersion).toBe(2);
    });

    it('should_log_audit_event_on_store', async () => {
      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-test',
      });

      const logs = await keyVault.getAuditLogs('user-1');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('key_stored');
    });
  });

  // ============================================================================
  // Key Retrieval Tests
  // ============================================================================

  describe('retrieveKey', () => {
    it('should_decrypt_and_return_key', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-secret-key-xyz',
      });

      const retrieved = await keyVault.retrieveKey(stored.id, 'user-1');

      expect(retrieved.plaintext).toBe('sk-secret-key-xyz');
      expect(retrieved.keyVersion).toBe(1);
    });

    it('should_reject_access_for_wrong_user', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-secret',
      });

      await expect(
        keyVault.retrieveKey(stored.id, 'user-2')
      ).rejects.toThrow('Access denied');
    });

    it('should_log_audit_event_on_retrieve', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-test',
      });

      await keyVault.retrieveKey(stored.id, 'user-1');

      const logs = await keyVault.getAuditLogs('user-1');
      const retrieveLog = logs.find(l => l.action === 'key_retrieved');
      expect(retrieveLog).toBeDefined();
    });

    it('should_return_null_for_nonexistent_key', async () => {
      await expect(
        keyVault.retrieveKey('nonexistent-id', 'user-1')
      ).rejects.toThrow('Key not found');
    });
  });

  // ============================================================================
  // Key Rotation Tests
  // ============================================================================

  describe('rotateKey', () => {
    it('should_re-encrypt_key_with_new_version', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'original-key',
      });

      const rotated = await keyVault.rotateKey(stored.id, 'user-1', 'new-key');

      expect(rotated.keyVersion).toBe(2);
      expect(rotated.encryptedKey).not.toBe(stored.encryptedKey);

      // Verify new key can be decrypted
      const retrieved = await keyVault.retrieveKey(rotated.id, 'user-1');
      expect(retrieved.plaintext).toBe('new-key');
    });

    it('should_log_rotation_audit_event', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'old-key',
      });

      await keyVault.rotateKey(stored.id, 'user-1', 'new-key');

      const logs = await keyVault.getAuditLogs('user-1');
      const rotateLog = logs.find(l => l.action === 'key_rotated');
      expect(rotateLog).toBeDefined();
    });
  });

  // ============================================================================
  // Key Deletion Tests
  // ============================================================================

  describe('deleteKey', () => {
    it('should_delete_key_from_vault', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-to-delete',
      });

      await keyVault.deleteKey(stored.id, 'user-1');

      await expect(
        keyVault.retrieveKey(stored.id, 'user-1')
      ).rejects.toThrow('Key not found');
    });

    it('should_log_deletion_audit_event', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'sk-delete-me',
      });

      await keyVault.deleteKey(stored.id, 'user-1');

      const logs = await keyVault.getAuditLogs('user-1');
      const deleteLog = logs.find(l => l.action === 'key_deleted');
      expect(deleteLog).toBeDefined();
    });

    it('should_reject_deletion_for_wrong_user', async () => {
      const stored = await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'protected-key',
      });

      await expect(
        keyVault.deleteKey(stored.id, 'user-2')
      ).rejects.toThrow('Access denied');
    });
  });

  // ============================================================================
  // List Keys Tests
  // ============================================================================

  describe('listKeys', () => {
    it('should_list_all_keys_for_user', async () => {
      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'key-1',
      });

      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'exchange',
        providerId: 'binance',
        plaintext: 'key-2',
      });

      const keys = await keyVault.listKeys('user-1');

      expect(keys.length).toBe(2);
      // Should not include plaintext keys
      expect(keys[0].plaintext).toBeUndefined();
    });

    it('should_filter_keys_by_type', async () => {
      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'ai-key',
      });

      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'exchange',
        providerId: 'binance',
        plaintext: 'exchange-key',
      });

      const aiKeys = await keyVault.listKeys('user-1', { keyType: 'ai_provider' });

      expect(aiKeys.length).toBe(1);
      expect(aiKeys[0].keyType).toBe('ai_provider');
    });
  });

  // ============================================================================
  // Audit Log Tests
  // ============================================================================

  describe('getAuditLogs', () => {
    it('should_return_all_audit_logs_for_user', async () => {
      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'key-1',
      });

      const logs = await keyVault.getAuditLogs('user-1');

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].userId).toBe('user-1');
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should_not_return_logs_for_other_users', async () => {
      await keyVault.storeKey({
        userId: 'user-1',
        keyType: 'ai_provider',
        providerId: 'openai',
        plaintext: 'key-1',
      });

      const logs = await keyVault.getAuditLogs('user-2');

      expect(logs.length).toBe(0);
    });
  });

  // ============================================================================
  // Key Masking Tests
  // ============================================================================

  describe('maskKey', () => {
    it('should_return_masked_version_of_key', () => {
      const masked = keyVault.maskKey('sk-1234567890abcdef');

      expect(masked).toBe('sk-1****cdef');
    });

    it('should_handle_short_keys', () => {
      const masked = keyVault.maskKey('abc');

      expect(masked).toBe('****');
    });
  });
});
