/**
 * Auth Routes Tests - TDD Red Phase
 * Tests for authentication API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createAuthRouter } from './auth.routes';
import { AuthService } from '../../users/AuthService';
import { MockDatabase, createMockDatabase } from '../../../tests/helpers/mock-db';
import { errorHandler } from '../middleware/error.middleware';

describe('Auth Routes', () => {
  let app: Express;
  let authService: AuthService;
  let db: MockDatabase;

  beforeEach(() => {
    db = createMockDatabase();
    authService = new AuthService({
      db,
      jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
      jwtExpiresIn: '24h',
      refreshTokenExpiresIn: '7d',
    });

    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthRouter(authService));
    app.use(errorHandler);
  });

  // ============================================================================
  // POST /api/auth/register
  // ============================================================================

  describe('POST /api/auth/register', () => {
    it('should_register_user_with_valid_data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      // Should not expose password
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should_reject_invalid_email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email');
    });

    it('should_reject_weak_password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should_reject_missing_email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'SecurePassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should_reject_missing_password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should_reject_duplicate_email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePassword123!',
        });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPassword123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Email already exists');
    });

    it('should_accept_optional_tier', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'prouser@example.com',
          password: 'SecurePassword123!',
          tier: 'pro',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.tier).toBe('pro');
    });
  });

  // ============================================================================
  // POST /api/auth/login
  // ============================================================================

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'existing@example.com',
        password: 'ExistingPassword123!',
      });
    });

    it('should_login_with_valid_credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'ExistingPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('existing@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should_reject_wrong_password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should_reject_nonexistent_email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should_capture_ip_address', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          email: 'existing@example.com',
          password: 'ExistingPassword123!',
        });

      expect(response.status).toBe(200);
      // IP should be logged in audit (we can't easily verify here, but route should pass it)
    });

    it('should_reject_missing_credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // POST /api/auth/refresh
  // ============================================================================

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'refresh@example.com',
        password: 'RefreshPassword123!',
      });
      refreshToken = result.refreshToken;
    });

    it('should_refresh_tokens_with_valid_refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should_reject_invalid_refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should_reject_missing_refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should_reject_used_refresh_token', async () => {
      // Use the token once
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      // Try to use it again
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // POST /api/auth/logout
  // ============================================================================

  describe('POST /api/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'logout@example.com',
        password: 'LogoutPassword123!',
      });
      accessToken = result.accessToken;
      refreshToken = result.refreshToken;
      userId = result.user.id;
    });

    it('should_logout_with_valid_token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out');
    });

    it('should_invalidate_refresh_token_after_logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      // Try to use refresh token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(401);
    });

    it('should_reject_logout_without_auth', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================================
  // GET /api/auth/me
  // ============================================================================

  describe('GET /api/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'me@example.com',
        password: 'MePassword123!',
      });
      accessToken = result.accessToken;
    });

    it('should_return_user_profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should_reject_invalid_token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should_reject_expired_token', async () => {
      // Create a service with very short token expiry
      const shortLivedDb = createMockDatabase();
      const shortLivedAuth = new AuthService({
        db: shortLivedDb,
        jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
        jwtExpiresIn: '1ms',
        refreshTokenExpiresIn: '7d',
      });

      const shortApp = express();
      shortApp.use(express.json());
      shortApp.use('/api/auth', createAuthRouter(shortLivedAuth));
      shortApp.use(errorHandler);

      const result = await shortLivedAuth.register({
        email: 'expired@example.com',
        password: 'ExpiredPassword123!',
      });

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(shortApp)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${result.accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });
  });

  // ============================================================================
  // POST /api/auth/change-password
  // ============================================================================

  describe('POST /api/auth/change-password', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'changepass@example.com',
        password: 'OldPassword123!',
      });
      accessToken = result.accessToken;
    });

    it('should_change_password_with_correct_current', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should be able to login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'changepass@example.com',
          password: 'NewPassword456!',
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should_reject_wrong_current_password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should_reject_weak_new_password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password must be at least 8 characters');
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(401);
    });

    it('should_invalidate_old_tokens_after_password_change', async () => {
      // Change password
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword456!',
        });

      // Old token should be invalid
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================================================
  // POST /api/auth/verify-email
  // ============================================================================

  describe('POST /api/auth/verify-email', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'verify@example.com',
        password: 'VerifyPassword123!',
      });
      userId = result.user.id;
    });

    it('should_verify_email_with_valid_token', async () => {
      const token = await authService.generateEmailVerificationToken(userId);

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');
    });

    it('should_reject_invalid_token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid verification token');
    });

    it('should_reject_missing_token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // POST /api/auth/request-verification
  // ============================================================================

  describe('POST /api/auth/request-verification', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'reqverify@example.com',
        password: 'ReqVerifyPassword123!',
      });
      accessToken = result.accessToken;
    });

    it('should_generate_verification_token', async () => {
      const response = await request(app)
        .post('/api/auth/request-verification')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should_reject_without_auth', async () => {
      const response = await request(app)
        .post('/api/auth/request-verification');

      expect(response.status).toBe(401);
    });
  });
});
