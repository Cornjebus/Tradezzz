/**
 * KeyVault Routes Tests - Phase 18: AI Key Security
 * TDD Red Phase - Write tests first
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createKeyVaultRouter } from './keyvault.routes';
import { KeyVaultService } from '../../security/KeyVaultService';
import { AuthService } from '../../users/AuthService';
import { createMockDatabase, MockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('KeyVault Routes', () => {
  let app: Express;
  let keyVault: KeyVaultService;
  let authService: AuthService;
  let db: MockDatabase;
  let accessToken: string;

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-ok!');

    db = createMockDatabase();
    keyVault = new KeyVaultService({ db });
    authService = new AuthService({
      db,
      jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });

    // Create test user and get token
    const result = await authService.register({
      email: 'keyvault-test@example.com',
      password: 'TestPassword123!',
      tier: 'pro',
    });
    accessToken = result.accessToken;

    app = express();
    app.use(express.json());
    app.use('/api/keyvault', createKeyVaultRouter(keyVault, authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // Store Key Tests
  // ============================================================================

  describe('POST /api/keyvault/keys', () => {
    it('should_store_new_ai_provider_key', async () => {
      const res = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyType: 'ai_provider',
          providerId: 'openai',
          key: 'sk-test-key-123',
          metadata: { purpose: 'trading-signals' },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.keyVersion).toBe(1);
      expect(res.body.data.maskedKey).toBeDefined();
      // Should NOT return plaintext
      expect(res.body.data.encryptedKey).toBeUndefined();
      expect(res.body.data.plaintext).toBeUndefined();
    });

    it('should_store_exchange_key', async () => {
      const res = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyType: 'exchange',
          providerId: 'binance',
          key: 'api-key-binance',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.keyType).toBe('exchange');
    });

    it('should_reject_without_auth', async () => {
      const res = await request(app)
        .post('/api/keyvault/keys')
        .send({
          keyType: 'ai_provider',
          providerId: 'openai',
          key: 'sk-test',
        });

      expect(res.status).toBe(401);
    });

    it('should_validate_required_fields', async () => {
      const res = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyType: 'ai_provider',
          // missing providerId and key
        });

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Retrieve Key Tests
  // ============================================================================

  describe('GET /api/keyvault/keys/:id', () => {
    it('should_retrieve_decrypted_key', async () => {
      // First store a key
      const storeRes = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          keyType: 'ai_provider',
          providerId: 'openai',
          key: 'sk-secret-key-xyz',
        });

      const keyId = storeRes.body.data.id;

      // Then retrieve it
      const res = await request(app)
        .get(`/api/keyvault/keys/${keyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plaintext).toBe('sk-secret-key-xyz');
    });

    it('should_return_404_for_nonexistent_key', async () => {
      const res = await request(app)
        .get('/api/keyvault/keys/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // List Keys Tests
  // ============================================================================

  describe('GET /api/keyvault/keys', () => {
    it('should_list_all_user_keys', async () => {
      // Store multiple keys
      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'key-1' });

      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'exchange', providerId: 'binance', key: 'key-2' });

      const res = await request(app)
        .get('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      // Keys should be masked, not plaintext
      res.body.data.forEach((key: any) => {
        expect(key.maskedKey).toBeDefined();
        expect(key.plaintext).toBeUndefined();
      });
    });

    it('should_filter_by_key_type', async () => {
      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'ai-key' });

      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'exchange', providerId: 'binance', key: 'exchange-key' });

      const res = await request(app)
        .get('/api/keyvault/keys?keyType=ai_provider')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].keyType).toBe('ai_provider');
    });

    it('should_filter_by_provider_id', async () => {
      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'openai-key' });

      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'anthropic', key: 'anthropic-key' });

      const res = await request(app)
        .get('/api/keyvault/keys?providerId=openai')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].providerId).toBe('openai');
    });
  });

  // ============================================================================
  // Rotate Key Tests
  // ============================================================================

  describe('POST /api/keyvault/keys/:id/rotate', () => {
    it('should_rotate_key_and_increment_version', async () => {
      // Store initial key
      const storeRes = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'old-key' });

      const keyId = storeRes.body.data.id;

      // Rotate key
      const rotateRes = await request(app)
        .post(`/api/keyvault/keys/${keyId}/rotate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newKey: 'new-secret-key' });

      expect(rotateRes.status).toBe(200);
      expect(rotateRes.body.data.keyVersion).toBe(2);

      // Verify new key can be retrieved
      const getRes = await request(app)
        .get(`/api/keyvault/keys/${keyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.body.data.plaintext).toBe('new-secret-key');
    });

    it('should_require_new_key', async () => {
      const storeRes = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'key' });

      const res = await request(app)
        .post(`/api/keyvault/keys/${storeRes.body.data.id}/rotate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({}); // missing newKey

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Delete Key Tests
  // ============================================================================

  describe('DELETE /api/keyvault/keys/:id', () => {
    it('should_delete_key', async () => {
      // Store key
      const storeRes = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'to-delete' });

      const keyId = storeRes.body.data.id;

      // Delete key
      const deleteRes = await request(app)
        .delete(`/api/keyvault/keys/${keyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify key is gone
      const getRes = await request(app)
        .get(`/api/keyvault/keys/${keyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  // ============================================================================
  // Audit Log Tests
  // ============================================================================

  describe('GET /api/keyvault/audit', () => {
    it('should_return_audit_logs_for_user', async () => {
      // Store a key (creates audit log)
      await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'key' });

      const res = await request(app)
        .get('/api/keyvault/audit')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].action).toBe('key_stored');
      expect(res.body.data[0].timestamp).toBeDefined();
    });

    it('should_track_multiple_actions', async () => {
      // Store
      const storeRes = await request(app)
        .post('/api/keyvault/keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ keyType: 'ai_provider', providerId: 'openai', key: 'key' });

      const keyId = storeRes.body.data.id;

      // Retrieve
      await request(app)
        .get(`/api/keyvault/keys/${keyId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      // Rotate
      await request(app)
        .post(`/api/keyvault/keys/${keyId}/rotate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newKey: 'new-key' });

      // Get audit logs
      const res = await request(app)
        .get('/api/keyvault/audit')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const actions = res.body.data.map((log: any) => log.action);
      expect(actions).toContain('key_stored');
      expect(actions).toContain('key_retrieved');
      expect(actions).toContain('key_rotated');
    });
  });
});
