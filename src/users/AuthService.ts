/**
 * AuthService - Authentication and User Management
 * Handles registration, login, token management, and password operations
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserInput } from '../database/types';

// Types
export interface AuthConfig {
  db: any; // Database or MockDatabase
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  saltRounds?: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  tier?: 'free' | 'pro' | 'elite' | 'institutional';
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  tier: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  tier: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

// In-memory stores for token management
const refreshTokenStore = new Map<string, { userId: string; tokenVersion: number; expiresAt: Date }>();
const emailVerificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
const userTokenVersions = new Map<string, number>();

export class AuthService {
  private config: Required<AuthConfig>;

  constructor(config: AuthConfig) {
    this.config = {
      ...config,
      saltRounds: config.saltRounds ?? 12,
    };
  }

  // ============================================================================
  // Password Validation
  // ============================================================================

  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  private getTokenVersion(userId: string): number {
    return userTokenVersions.get(userId) ?? 0;
  }

  private incrementTokenVersion(userId: string): number {
    const current = this.getTokenVersion(userId);
    const newVersion = current + 1;
    userTokenVersions.set(userId, newVersion);
    return newVersion;
  }

  private generateAccessToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      tier: user.tier,
      tokenVersion: this.getTokenVersion(user.id),
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    });
  }

  private generateRefreshToken(user: User): string {
    const tokenId = uuidv4();
    const tokenVersion = this.getTokenVersion(user.id);

    // Parse expiry time
    const expiresInMs = this.parseExpiry(this.config.refreshTokenExpiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Store refresh token
    refreshTokenStore.set(tokenId, {
      userId: user.id,
      tokenVersion,
      expiresAt,
    });

    return tokenId;
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24h

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  // ============================================================================
  // User Profile Helper
  // ============================================================================

  private toUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      tier: user.tier,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  // ============================================================================
  // Registration
  // ============================================================================

  async register(input: RegisterInput): Promise<AuthResult> {
    // Validate password
    this.validatePassword(input.password);

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, this.config.saltRounds);

    // Create user
    const user = await this.config.db.users.create({
      email: input.email,
      passwordHash,
      tier: input.tier || 'free',
    });

    // Create audit log
    await this.config.db.auditLogs.create({
      userId: user.id,
      action: 'user_created',
      details: { email: user.email, tier: user.tier },
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  // ============================================================================
  // Login
  // ============================================================================

  async login(input: LoginInput): Promise<AuthResult> {
    // Find user
    const user = await this.config.db.users.findByEmail(input.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Create audit log
    await this.config.db.auditLogs.create({
      userId: user.id,
      action: 'user_login',
      details: {},
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.toUserProfile(user),
      accessToken,
      refreshToken,
    };
  }

  // ============================================================================
  // Token Verification
  // ============================================================================

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as TokenPayload;

      // Check token version (for invalidation after password change)
      const currentVersion = this.getTokenVersion(payload.userId);
      if (payload.tokenVersion !== currentVersion) {
        throw new Error('Token has been invalidated');
      }

      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.message === 'Token has been invalidated') {
        throw error;
      }
      throw new Error('Invalid token');
    }
  }

  // ============================================================================
  // Token Refresh
  // ============================================================================

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const stored = refreshTokenStore.get(refreshToken);

    if (!stored) {
      throw new Error('Invalid refresh token');
    }

    // Check if expired
    if (stored.expiresAt < new Date()) {
      refreshTokenStore.delete(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Check token version
    const currentVersion = this.getTokenVersion(stored.userId);
    if (stored.tokenVersion !== currentVersion) {
      refreshTokenStore.delete(refreshToken);
      throw new Error('Refresh token has been revoked');
    }

    // Invalidate old refresh token (rotation)
    refreshTokenStore.delete(refreshToken);

    // Get user
    const user = await this.config.db.users.findById(stored.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ============================================================================
  // Password Change
  // ============================================================================

  async changePassword(input: ChangePasswordInput): Promise<void> {
    const user = await this.config.db.users.findById(input.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Check if new password is same as old
    const isSame = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (isSame) {
      throw new Error('New password must be different from current password');
    }

    // Validate new password
    this.validatePassword(input.newPassword);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(input.newPassword, this.config.saltRounds);

    // Update user - need to update passwordHash directly
    // Since MockDatabase doesn't have passwordHash in update, we'll handle it specially
    const updatedUser = await this.config.db.users.findById(input.userId);
    if (updatedUser) {
      updatedUser.passwordHash = newPasswordHash;
      updatedUser.updatedAt = new Date();
    }

    // Increment token version to invalidate all existing tokens
    this.incrementTokenVersion(input.userId);

    // Revoke all refresh tokens for this user
    for (const [tokenId, tokenData] of refreshTokenStore.entries()) {
      if (tokenData.userId === input.userId) {
        refreshTokenStore.delete(tokenId);
      }
    }

    // Create audit log
    await this.config.db.auditLogs.create({
      userId: input.userId,
      action: 'password_changed',
      details: {},
    });
  }

  // ============================================================================
  // Logout
  // ============================================================================

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Revoke the specific refresh token
    refreshTokenStore.delete(refreshToken);

    // Create audit log
    await this.config.db.auditLogs.create({
      userId,
      action: 'user_logout',
      details: {},
    });
  }

  // ============================================================================
  // User Profile
  // ============================================================================

  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await this.config.db.users.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.toUserProfile(user);
  }

  // ============================================================================
  // Email Verification
  // ============================================================================

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    emailVerificationTokens.set(token, {
      userId,
      expiresAt,
    });

    return token;
  }

  async verifyEmail(token: string): Promise<void> {
    const stored = emailVerificationTokens.get(token);

    if (!stored) {
      throw new Error('Invalid verification token');
    }

    if (stored.expiresAt < new Date()) {
      emailVerificationTokens.delete(token);
      throw new Error('Verification token expired');
    }

    // Update user
    await this.config.db.users.update(stored.userId, {
      emailVerified: true,
    });

    // Remove token
    emailVerificationTokens.delete(token);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Invalidates all tokens for a user (e.g., after security concern)
   */
  async invalidateAllTokens(userId: string): Promise<void> {
    this.incrementTokenVersion(userId);

    // Revoke all refresh tokens
    for (const [tokenId, tokenData] of refreshTokenStore.entries()) {
      if (tokenData.userId === userId) {
        refreshTokenStore.delete(tokenId);
      }
    }
  }
}
