/**
 * AuthService Tests - TDD Red Phase
 * Defines expected behavior for authentication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './AuthService';
import { MockDatabase, createMockDatabase } from '../../tests/helpers/mock-db';

describe('AuthService', () => {
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
  });

  // ============================================================================
  // Registration Tests
  // ============================================================================

  describe('register', () => {
    it('should_register_user_with_valid_credentials', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.tier).toBe('free');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should_hash_password_before_storing', async () => {
      const result = await authService.register({
        email: 'hashtest@example.com',
        password: 'MyPassword123!',
      });

      // Password should not be stored in plain text
      const storedUser = await db.users.findByEmail('hashtest@example.com');
      expect(storedUser?.passwordHash).not.toBe('MyPassword123!');
      expect(storedUser?.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt format
    });

    it('should_reject_weak_password', async () => {
      await expect(
        authService.register({
          email: 'weak@example.com',
          password: '123', // Too short
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should_reject_password_without_uppercase', async () => {
      await expect(
        authService.register({
          email: 'nouppercase@example.com',
          password: 'lowercase123!',
        })
      ).rejects.toThrow('Password must contain at least one uppercase letter');
    });

    it('should_reject_password_without_number', async () => {
      await expect(
        authService.register({
          email: 'nonumber@example.com',
          password: 'NoNumberHere!',
        })
      ).rejects.toThrow('Password must contain at least one number');
    });

    it('should_reject_duplicate_email', async () => {
      await authService.register({
        email: 'duplicate@example.com',
        password: 'ValidPassword123!',
      });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'AnotherPassword123!',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should_reject_invalid_email_format', async () => {
      await expect(
        authService.register({
          email: 'not-an-email',
          password: 'ValidPassword123!',
        })
      ).rejects.toThrow('Invalid email');
    });

    it('should_create_audit_log_on_registration', async () => {
      const result = await authService.register({
        email: 'audit@example.com',
        password: 'ValidPassword123!',
      });

      const logs = await db.auditLogs.findByUserId(result.user.id);
      expect(logs.some(log => log.action === 'user_created')).toBe(true);
    });
  });

  // ============================================================================
  // Login Tests
  // ============================================================================

  describe('login', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'logintest@example.com',
        password: 'TestPassword123!',
      });
    });

    it('should_login_with_valid_credentials', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'TestPassword123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('logintest@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should_reject_wrong_password', async () => {
      await expect(
        authService.login({
          email: 'logintest@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_reject_nonexistent_email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should_reject_inactive_user', async () => {
      // Deactivate user
      const user = await db.users.findByEmail('logintest@example.com');
      await db.users.update(user!.id, { isActive: false });

      await expect(
        authService.login({
          email: 'logintest@example.com',
          password: 'TestPassword123!',
        })
      ).rejects.toThrow('Account is deactivated');
    });

    it('should_create_audit_log_on_login', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'TestPassword123!',
      });

      const logs = await db.auditLogs.findByUserId(result.user.id);
      expect(logs.some(log => log.action === 'user_login')).toBe(true);
    });

    it('should_include_ip_in_audit_log_when_provided', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'TestPassword123!',
        ipAddress: '192.168.1.100',
      });

      const logs = await db.auditLogs.findByUserId(result.user.id);
      const loginLog = logs.find(log => log.action === 'user_login');
      expect(loginLog?.ipAddress).toBe('192.168.1.100');
    });
  });

  // ============================================================================
  // Token Verification Tests
  // ============================================================================

  describe('verifyToken', () => {
    it('should_verify_valid_access_token', async () => {
      const { accessToken, user } = await authService.register({
        email: 'tokentest@example.com',
        password: 'ValidPassword123!',
      });

      const payload = await authService.verifyAccessToken(accessToken);

      expect(payload.userId).toBe(user.id);
      expect(payload.email).toBe('tokentest@example.com');
    });

    it('should_reject_expired_token', async () => {
      // Create service with very short expiry
      const shortLivedAuth = new AuthService({
        db,
        jwtSecret: 'test-jwt-secret-key-minimum-32-chars!!',
        jwtExpiresIn: '1ms',
        refreshTokenExpiresIn: '7d',
      });

      const { accessToken } = await shortLivedAuth.register({
        email: 'expiredtoken@example.com',
        password: 'ValidPassword123!',
      });

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(
        shortLivedAuth.verifyAccessToken(accessToken)
      ).rejects.toThrow('Token expired');
    });

    it('should_reject_invalid_token', async () => {
      await expect(
        authService.verifyAccessToken('invalid.token.here')
      ).rejects.toThrow('Invalid token');
    });

    it('should_reject_token_with_wrong_secret', async () => {
      const { accessToken } = await authService.register({
        email: 'wrongsecret@example.com',
        password: 'ValidPassword123!',
      });

      // Create another service with different secret
      const otherAuth = new AuthService({
        db,
        jwtSecret: 'different-secret-key-minimum-32-chars!!',
        jwtExpiresIn: '24h',
        refreshTokenExpiresIn: '7d',
      });

      await expect(
        otherAuth.verifyAccessToken(accessToken)
      ).rejects.toThrow('Invalid token');
    });
  });

  // ============================================================================
  // Token Refresh Tests
  // ============================================================================

  describe('refreshToken', () => {
    it('should_refresh_tokens_with_valid_refresh_token', async () => {
      const original = await authService.register({
        email: 'refresh@example.com',
        password: 'ValidPassword123!',
      });

      // Small delay to ensure different token
      await new Promise(resolve => setTimeout(resolve, 10));

      const refreshed = await authService.refreshTokens(original.refreshToken);

      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.refreshToken).toBeDefined();
      // New refresh token should be different
      expect(refreshed.refreshToken).not.toBe(original.refreshToken);
    });

    it('should_reject_invalid_refresh_token', async () => {
      await expect(
        authService.refreshTokens('invalid-refresh-token')
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should_reject_used_refresh_token_after_rotation', async () => {
      const original = await authService.register({
        email: 'rotation@example.com',
        password: 'ValidPassword123!',
      });

      // Use the refresh token
      await authService.refreshTokens(original.refreshToken);

      // Try to use it again (should fail - token rotation)
      await expect(
        authService.refreshTokens(original.refreshToken)
      ).rejects.toThrow('Invalid refresh token'); // Token deleted after use
    });
  });

  // ============================================================================
  // Password Change Tests
  // ============================================================================

  describe('changePassword', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'changepass@example.com',
        password: 'OldPassword123!',
      });
      userId = result.user.id;
    });

    it('should_change_password_with_correct_current_password', async () => {
      await authService.changePassword({
        userId,
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      });

      // Should be able to login with new password
      const result = await authService.login({
        email: 'changepass@example.com',
        password: 'NewPassword456!',
      });

      expect(result.user).toBeDefined();
    });

    it('should_reject_wrong_current_password', async () => {
      await expect(
        authService.changePassword({
          userId,
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        })
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should_reject_weak_new_password', async () => {
      await expect(
        authService.changePassword({
          userId,
          currentPassword: 'OldPassword123!',
          newPassword: 'weak',
        })
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should_reject_same_password', async () => {
      await expect(
        authService.changePassword({
          userId,
          currentPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!',
        })
      ).rejects.toThrow('New password must be different from current password');
    });

    it('should_create_audit_log_on_password_change', async () => {
      await authService.changePassword({
        userId,
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      });

      const logs = await db.auditLogs.findByUserId(userId);
      expect(logs.some(log => log.action === 'password_changed')).toBe(true);
    });

    it('should_invalidate_all_sessions_on_password_change', async () => {
      const { accessToken } = await authService.login({
        email: 'changepass@example.com',
        password: 'OldPassword123!',
      });

      await authService.changePassword({
        userId,
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      });

      // Old token should be invalid
      await expect(
        authService.verifyAccessToken(accessToken)
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // Logout Tests
  // ============================================================================

  describe('logout', () => {
    it('should_invalidate_refresh_token_on_logout', async () => {
      const { refreshToken, user } = await authService.register({
        email: 'logout@example.com',
        password: 'ValidPassword123!',
      });

      await authService.logout(user.id, refreshToken);

      await expect(
        authService.refreshTokens(refreshToken)
      ).rejects.toThrow('Invalid refresh token'); // Token deleted on logout
    });

    it('should_create_audit_log_on_logout', async () => {
      const { refreshToken, user } = await authService.register({
        email: 'logoutaudit@example.com',
        password: 'ValidPassword123!',
      });

      await authService.logout(user.id, refreshToken);

      const logs = await db.auditLogs.findByUserId(user.id);
      expect(logs.some(log => log.action === 'user_logout')).toBe(true);
    });
  });

  // ============================================================================
  // User Profile Tests
  // ============================================================================

  describe('getUserProfile', () => {
    it('should_return_user_profile_without_password', async () => {
      const { user } = await authService.register({
        email: 'profile@example.com',
        password: 'ValidPassword123!',
      });

      const profile = await authService.getUserProfile(user.id);

      expect(profile.email).toBe('profile@example.com');
      expect(profile.tier).toBe('free');
      expect((profile as any).passwordHash).toBeUndefined();
      expect((profile as any).password).toBeUndefined();
    });

    it('should_throw_for_nonexistent_user', async () => {
      await expect(
        authService.getUserProfile('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('User not found');
    });
  });

  // ============================================================================
  // Email Verification Tests
  // ============================================================================

  describe('emailVerification', () => {
    it('should_generate_verification_token', async () => {
      const { user } = await authService.register({
        email: 'verify@example.com',
        password: 'ValidPassword123!',
      });

      const token = await authService.generateEmailVerificationToken(user.id);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should_verify_email_with_valid_token', async () => {
      const { user } = await authService.register({
        email: 'verifyvalid@example.com',
        password: 'ValidPassword123!',
      });

      const token = await authService.generateEmailVerificationToken(user.id);
      await authService.verifyEmail(token);

      const updatedUser = await db.users.findById(user.id);
      expect(updatedUser?.emailVerified).toBe(true);
    });

    it('should_reject_invalid_verification_token', async () => {
      await expect(
        authService.verifyEmail('invalid-token')
      ).rejects.toThrow('Invalid verification token');
    });
  });
});
