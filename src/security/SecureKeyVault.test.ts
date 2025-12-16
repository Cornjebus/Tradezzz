/**
 * SecureKeyVault Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecureKeyVault, AuditEvent, InMemoryStorage } from './SecureKeyVault';

describe('SecureKeyVault', () => {
  const MASTER_PASSWORD = 'SuperSecure123!';
  let vault: SecureKeyVault;
  let auditEvents: AuditEvent[];

  beforeEach(async () => {
    auditEvents = [];
    vault = new SecureKeyVault({
      masterPassword: MASTER_PASSWORD,
      auditLog: (event) => auditEvents.push(event),
    });
    await vault.initialize();
  });

  describe('Constructor', () => {
    it('should_require_master_password', () => {
      expect(() => new SecureKeyVault({ masterPassword: '' })).toThrow(
        'Master password must be at least 12 characters'
      );
    });

    it('should_require_minimum_password_length', () => {
      expect(() => new SecureKeyVault({ masterPassword: 'short' })).toThrow(
        'Master password must be at least 12 characters'
      );
    });

    it('should_accept_valid_password', () => {
      const vault = new SecureKeyVault({ masterPassword: 'ValidPassword1!' });
      expect(vault).toBeDefined();
    });

    it('should_accept_custom_storage', () => {
      const storage = new InMemoryStorage();
      const vault = new SecureKeyVault({
        masterPassword: MASTER_PASSWORD,
        storage,
      });
      expect(vault).toBeDefined();
    });
  });

  describe('storeKey', () => {
    it('should_store_key_with_encryption', async () => {
      const stored = await vault.storeKey(
        'openai-key',
        'openai',
        'sk-test-api-key-12345'
      );

      expect(stored.id).toBe('openai-key');
      expect(stored.provider).toBe('openai');
      expect(stored.encryptedKey.ciphertext).toBeDefined();
      expect(stored.encryptedKey.iv).toBeDefined();
      expect(stored.encryptedKey.salt).toBeDefined();
      expect(stored.keyHash).toBeDefined();
      expect(stored.createdAt).toBeInstanceOf(Date);
    });

    it('should_store_metadata', async () => {
      const stored = await vault.storeKey(
        'anthropic-key',
        'anthropic',
        'sk-ant-key',
        { tier: 'premium', environment: 'production' }
      );

      expect(stored.metadata?.tier).toBe('premium');
      expect(stored.metadata?.environment).toBe('production');
    });

    it('should_log_audit_event', async () => {
      await vault.storeKey('key1', 'openai', 'sk-key');

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('store');
      expect(auditEvents[0].keyId).toBe('key1');
      expect(auditEvents[0].provider).toBe('openai');
      expect(auditEvents[0].success).toBe(true);
    });
  });

  describe('retrieveKey', () => {
    it('should_retrieve_and_decrypt_key', async () => {
      const apiKey = 'sk-openai-secret-key-xyz';
      await vault.storeKey('my-key', 'openai', apiKey);

      const retrieved = await vault.retrieveKey('my-key');

      expect(retrieved).toBe(apiKey);
    });

    it('should_update_lastUsed_timestamp', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-key');

      await vault.retrieveKey('my-key');
      const stored = await vault.getStoredKey('my-key');

      expect(stored?.lastUsed).toBeInstanceOf(Date);
    });

    it('should_throw_for_nonexistent_key', async () => {
      await expect(vault.retrieveKey('nonexistent')).rejects.toThrow(
        'Key not found: nonexistent'
      );
    });

    it('should_log_audit_event', async () => {
      await vault.storeKey('key1', 'openai', 'sk-key');
      auditEvents = [];

      await vault.retrieveKey('key1');

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('retrieve');
      expect(auditEvents[0].success).toBe(true);
    });
  });

  describe('deleteKey', () => {
    it('should_delete_stored_key', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-key');

      await vault.deleteKey('my-key');

      const exists = await vault.hasKey('my-key');
      expect(exists).toBe(false);
    });

    it('should_log_audit_event', async () => {
      await vault.storeKey('key1', 'openai', 'sk-key');
      auditEvents = [];

      await vault.deleteKey('key1');

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('delete');
      expect(auditEvents[0].success).toBe(true);
    });
  });

  describe('rotateKey', () => {
    it('should_replace_key_with_new_value', async () => {
      const oldKey = 'sk-old-key';
      const newKey = 'sk-new-key';

      await vault.storeKey('my-key', 'openai', oldKey);
      await vault.rotateKey('my-key', newKey);

      const retrieved = await vault.retrieveKey('my-key');
      expect(retrieved).toBe(newKey);
    });

    it('should_update_rotatedAt_timestamp', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-old');
      await vault.rotateKey('my-key', 'sk-new');

      const stored = await vault.getStoredKey('my-key');
      expect(stored?.rotatedAt).toBeInstanceOf(Date);
    });

    it('should_preserve_metadata', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-old', {
        environment: 'prod',
      });
      await vault.rotateKey('my-key', 'sk-new');

      const stored = await vault.getStoredKey('my-key');
      expect(stored?.metadata?.environment).toBe('prod');
    });

    it('should_throw_for_nonexistent_key', async () => {
      await expect(
        vault.rotateKey('nonexistent', 'sk-new')
      ).rejects.toThrow('Key not found: nonexistent');
    });

    it('should_log_audit_event', async () => {
      await vault.storeKey('key1', 'openai', 'sk-old');
      auditEvents = [];

      await vault.rotateKey('key1', 'sk-new');

      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('rotate');
      expect(auditEvents[0].success).toBe(true);
    });
  });

  describe('listKeys', () => {
    it('should_list_all_stored_keys', async () => {
      await vault.storeKey('key1', 'openai', 'sk-1');
      await vault.storeKey('key2', 'anthropic', 'sk-2');
      await vault.storeKey('key3', 'deepseek', 'sk-3');

      const keys = await vault.listKeys();

      expect(keys.length).toBe(3);
      expect(keys.map(k => k.id).sort()).toEqual(['key1', 'key2', 'key3']);
    });

    it('should_return_empty_array_when_no_keys', async () => {
      const keys = await vault.listKeys();
      expect(keys).toEqual([]);
    });

    it('should_not_expose_decrypted_keys', async () => {
      await vault.storeKey('key1', 'openai', 'sk-secret');

      const keys = await vault.listKeys();

      // Verify the encryptedKey is present but not the plaintext
      expect(keys[0].encryptedKey.ciphertext).toBeDefined();
      expect((keys[0] as any).apiKey).toBeUndefined();
    });
  });

  describe('verifyKey', () => {
    it('should_return_true_for_correct_key', async () => {
      const apiKey = 'sk-verify-me';
      await vault.storeKey('my-key', 'openai', apiKey);

      const valid = await vault.verifyKey('my-key', apiKey);
      expect(valid).toBe(true);
    });

    it('should_return_false_for_incorrect_key', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-correct');

      const valid = await vault.verifyKey('my-key', 'sk-wrong');
      expect(valid).toBe(false);
    });

    it('should_return_false_for_nonexistent_key', async () => {
      const valid = await vault.verifyKey('nonexistent', 'sk-any');
      expect(valid).toBe(false);
    });
  });

  describe('hasKey', () => {
    it('should_return_true_if_key_exists', async () => {
      await vault.storeKey('my-key', 'openai', 'sk-key');

      const exists = await vault.hasKey('my-key');
      expect(exists).toBe(true);
    });

    it('should_return_false_if_key_not_exists', async () => {
      const exists = await vault.hasKey('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('getKeyByProvider', () => {
    it('should_find_key_by_provider', async () => {
      await vault.storeKey('key1', 'openai', 'sk-1');
      await vault.storeKey('key2', 'anthropic', 'sk-2');

      const key = await vault.getKeyByProvider('anthropic');
      expect(key?.id).toBe('key2');
    });

    it('should_return_null_if_provider_not_found', async () => {
      await vault.storeKey('key1', 'openai', 'sk-1');

      const key = await vault.getKeyByProvider('groq');
      expect(key).toBeNull();
    });
  });

  describe('changeMasterPassword', () => {
    it('should_reencrypt_all_keys', async () => {
      const apiKey1 = 'sk-key-1';
      const apiKey2 = 'sk-key-2';

      await vault.storeKey('key1', 'openai', apiKey1);
      await vault.storeKey('key2', 'anthropic', apiKey2);

      const newPassword = 'NewPassword123!';
      await vault.changeMasterPassword(newPassword);

      // Should be able to retrieve with new password
      const retrieved1 = await vault.retrieveKey('key1');
      const retrieved2 = await vault.retrieveKey('key2');

      expect(retrieved1).toBe(apiKey1);
      expect(retrieved2).toBe(apiKey2);
    });

    it('should_reject_weak_password', async () => {
      await expect(
        vault.changeMasterPassword('weak')
      ).rejects.toThrow('must be at least 12 characters');
    });
  });

  describe('InMemoryStorage', () => {
    it('should_store_and_retrieve_values', async () => {
      const storage = new InMemoryStorage();

      await storage.set('key1', 'value1');
      const value = await storage.get('key1');

      expect(value).toBe('value1');
    });

    it('should_return_null_for_missing_keys', async () => {
      const storage = new InMemoryStorage();

      const value = await storage.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should_delete_values', async () => {
      const storage = new InMemoryStorage();

      await storage.set('key1', 'value1');
      await storage.delete('key1');
      const value = await storage.get('key1');

      expect(value).toBeNull();
    });

    it('should_list_by_prefix', async () => {
      const storage = new InMemoryStorage();

      await storage.set('keys:1', 'v1');
      await storage.set('keys:2', 'v2');
      await storage.set('other:1', 'v3');

      const keys = await storage.list('keys:');

      expect(keys).toEqual(['keys:1', 'keys:2']);
    });
  });

  describe('Audit logging', () => {
    it('should_log_failed_operations', async () => {
      await expect(vault.retrieveKey('nonexistent')).rejects.toThrow();

      const failedEvent = auditEvents.find(
        e => e.action === 'retrieve' && !e.success
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.error).toBeDefined();
    });

    it('should_include_timestamps', async () => {
      await vault.storeKey('key1', 'openai', 'sk-key');

      expect(auditEvents[0].timestamp).toBeInstanceOf(Date);
    });
  });
});
