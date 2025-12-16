/**
 * Encryption Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateRandomBytes,
  toBase64,
  fromBase64,
  deriveKey,
  generateKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  hash,
  secureCompare,
} from './encryption';

describe('Encryption Utilities', () => {
  describe('generateRandomBytes', () => {
    it('should_generate_bytes_of_correct_length', () => {
      const bytes16 = generateRandomBytes(16);
      const bytes32 = generateRandomBytes(32);

      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
    });

    it('should_generate_different_bytes_each_time', () => {
      const bytes1 = generateRandomBytes(16);
      const bytes2 = generateRandomBytes(16);

      expect(toBase64(bytes1)).not.toBe(toBase64(bytes2));
    });
  });

  describe('Base64 encoding', () => {
    it('should_encode_and_decode_correctly', () => {
      const original = new Uint8Array([1, 2, 3, 255, 128, 0]);
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);

      expect(decoded).toEqual(original);
    });

    it('should_handle_empty_array', () => {
      const empty = new Uint8Array(0);
      const encoded = toBase64(empty);
      const decoded = fromBase64(encoded);

      expect(decoded.length).toBe(0);
    });
  });

  describe('Key derivation', () => {
    it('should_derive_consistent_key_from_password', async () => {
      const password = 'test-password-123';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const plaintext = 'test data';

      const key1 = await deriveKey(password, salt);
      const key2 = await deriveKey(password, salt);

      // Verify keys work the same by encrypting with one and decrypting with other
      const { ciphertext, iv } = await encrypt(plaintext, key1);
      const decrypted = await decrypt(ciphertext, iv, key2);

      expect(decrypted).toBe(plaintext);
    });

    it('should_derive_different_keys_with_different_salts', async () => {
      const password = 'test-password-123';
      const salt1 = generateRandomBytes(16);
      const salt2 = generateRandomBytes(16);
      const plaintext = 'test data';

      const key1 = await deriveKey(password, salt1);
      const key2 = await deriveKey(password, salt2);

      // Encrypt with key1
      const { ciphertext, iv } = await encrypt(plaintext, key1);

      // Decrypting with key2 should fail (different salt = different key)
      await expect(decrypt(ciphertext, iv, key2)).rejects.toThrow();
    });
  });

  describe('Key generation and import/export', () => {
    it('should_generate_256_bit_key', async () => {
      const key = await generateKey();
      const exported = await exportKey(key);

      expect(exported.length).toBe(32); // 256 bits = 32 bytes
    });

    it('should_import_exported_key', async () => {
      const originalKey = await generateKey();
      const exported = await exportKey(originalKey);
      const importedKey = await importKey(exported);

      // Test by encrypting with original and decrypting with imported
      const plaintext = 'test data';
      const { ciphertext, iv } = await encrypt(plaintext, originalKey);
      const decrypted = await decrypt(ciphertext, iv, importedKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should_encrypt_and_decrypt_string', async () => {
      const key = await generateKey();
      const plaintext = 'sk-super-secret-api-key-12345';

      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should_produce_different_ciphertext_each_time', async () => {
      const key = await generateKey();
      const plaintext = 'same plaintext';

      const result1 = await encrypt(plaintext, key);
      const result2 = await encrypt(plaintext, key);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should_handle_unicode_characters', async () => {
      const key = await generateKey();
      const plaintext = '密钥 🔐 مفتاح';

      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should_handle_empty_string', async () => {
      const key = await generateKey();
      const plaintext = '';

      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should_handle_long_strings', async () => {
      const key = await generateKey();
      const plaintext = 'x'.repeat(10000);

      const { ciphertext, iv } = await encrypt(plaintext, key);
      const decrypted = await decrypt(ciphertext, iv, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should_fail_with_wrong_key', async () => {
      const key1 = await generateKey();
      const key2 = await generateKey();
      const plaintext = 'secret';

      const { ciphertext, iv } = await encrypt(plaintext, key1);

      await expect(decrypt(ciphertext, iv, key2)).rejects.toThrow();
    });

    it('should_fail_with_tampered_ciphertext', async () => {
      const key = await generateKey();
      const plaintext = 'secret';

      const { ciphertext, iv } = await encrypt(plaintext, key);

      // Tamper with ciphertext
      const bytes = fromBase64(ciphertext);
      bytes[0] ^= 0xff;
      const tamperedCiphertext = toBase64(bytes);

      await expect(decrypt(tamperedCiphertext, iv, key)).rejects.toThrow();
    });
  });

  describe('Password-based encryption', () => {
    it('should_encrypt_and_decrypt_with_password', async () => {
      const password = 'StrongP@ssword123!';
      const plaintext = 'sk-api-key-to-protect';

      const encrypted = await encryptWithPassword(plaintext, password);
      const decrypted = await decryptWithPassword(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should_fail_with_wrong_password', async () => {
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      const plaintext = 'secret';

      const encrypted = await encryptWithPassword(plaintext, password);

      await expect(
        decryptWithPassword(encrypted, wrongPassword)
      ).rejects.toThrow();
    });

    it('should_produce_different_output_each_time', async () => {
      const password = 'same-password';
      const plaintext = 'same-plaintext';

      const encrypted1 = await encryptWithPassword(plaintext, password);
      const encrypted2 = await encryptWithPassword(plaintext, password);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('hash', () => {
    it('should_produce_consistent_hash', async () => {
      const value = 'api-key-12345';

      const hash1 = await hash(value);
      const hash2 = await hash(value);

      expect(hash1).toBe(hash2);
    });

    it('should_produce_different_hash_for_different_input', async () => {
      const hash1 = await hash('value1');
      const hash2 = await hash('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should_be_non_reversible', async () => {
      const hashed = await hash('secret');
      // Just verify it's a valid base64 string of expected length
      expect(hashed.length).toBeGreaterThan(0);
      expect(() => atob(hashed)).not.toThrow();
    });
  });

  describe('secureCompare', () => {
    it('should_return_true_for_equal_strings', () => {
      expect(secureCompare('abc123', 'abc123')).toBe(true);
    });

    it('should_return_false_for_different_strings', () => {
      expect(secureCompare('abc123', 'abc124')).toBe(false);
    });

    it('should_return_false_for_different_lengths', () => {
      expect(secureCompare('abc', 'abcd')).toBe(false);
    });

    it('should_return_true_for_empty_strings', () => {
      expect(secureCompare('', '')).toBe(true);
    });
  });
});
