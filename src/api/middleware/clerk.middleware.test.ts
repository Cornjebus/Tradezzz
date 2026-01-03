import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireTier, getTierLimits } from './clerk.middleware';

function createMockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
  } as unknown as Request;
}

function createMockRes() {
  const res: Partial<Response> = {};
  res.statusCode = 200;
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockReturnValue(res);
  return res as Response & { statusCode: number };
}

describe('clerk.middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('requireAuth_should_reject_missing_auth_header', async () => {
    // SECURITY: Dev bypass has been removed
    // Requests without Authorization header should be rejected
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn<NextFunction>();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Missing or invalid authorization header' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAuth_should_reject_invalid_bearer_token_format', async () => {
    const req = createMockReq({ authorization: 'InvalidFormat token123' });
    const res = createMockRes();
    const next = vi.fn<NextFunction>();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('getTierLimits_should_return_defaults_for_unknown_tier', () => {
    const freeLimits = getTierLimits('free');
    const unknownLimits = getTierLimits('unknown');

    expect(freeLimits.strategies).toBe(1);
    expect(unknownLimits).toEqual(freeLimits);
  });

  it('requireTier_should_reject_missing_auth', () => {
    const middleware = requireTier('pro');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireTier_should_allow_user_with_required_tier', () => {
    const middleware = requireTier('pro');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn<NextFunction>();

    (req as any).auth = {
      user: { tier: 'pro' },
    };

    middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('requireTier_should_reject_user_with_insufficient_tier', () => {
    const middleware = requireTier('elite');
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn<NextFunction>();

    (req as any).auth = {
      user: { tier: 'free' },
    };

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

