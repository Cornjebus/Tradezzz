/**
 * Encryption Utilities - AES-256-GCM for secure API key storage
 *
 * Uses Web Crypto API for cross-platform compatibility
 * - AES-256-GCM provides authenticated encryption
 * - Random IV per encryption for semantic security
 * - PBKDF2 key derivation from master password
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded (if using password derivation)
  tag: string; // Authentication tag (included in ciphertext for Web Crypto)
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Convert Uint8Array to Base64
 */
export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert Base64 to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive encryption key from password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random AES-256 key
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to raw bytes for storage
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

/**
 * Import key from raw bytes
 */
export async function importKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param key - CryptoKey for encryption
 * @returns Encrypted data with IV
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = generateRandomBytes(IV_LENGTH);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    iv: toBase64(iv),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param ciphertext - Base64 encoded ciphertext
 * @param iv - Base64 encoded IV
 * @param key - CryptoKey for decryption
 * @returns Decrypted plaintext
 */
export async function decrypt(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );

  return decoder.decode(plaintextBuffer);
}

/**
 * Encrypt with password (includes salt for key derivation)
 */
export async function encryptWithPassword(
  plaintext: string,
  password: string
): Promise<EncryptedData> {
  const salt = generateRandomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  const { ciphertext, iv } = await encrypt(plaintext, key);

  return {
    ciphertext,
    iv,
    salt: toBase64(salt),
    tag: '', // Tag is included in ciphertext for Web Crypto
  };
}

/**
 * Decrypt with password
 */
export async function decryptWithPassword(
  data: EncryptedData,
  password: string
): Promise<string> {
  const salt = fromBase64(data.salt);
  const key = await deriveKey(password, salt);
  return decrypt(data.ciphertext, data.iv, key);
}

/**
 * Hash a value for comparison (non-reversible)
 */
export async function hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64(new Uint8Array(hashBuffer));
}

/**
 * Secure string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
