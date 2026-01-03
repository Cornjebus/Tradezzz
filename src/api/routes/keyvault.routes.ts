/**
 * KeyVault Routes - Phase 18: AI Key Security API
 *
 * Provides secure API key management endpoints:
 * - Store encrypted keys
 * - Retrieve decrypted keys
 * - Rotate keys
 * - Delete keys
 * - List keys with masking
 * - Audit log access
 */

import { Router, Request, Response } from 'express';
import { KeyVaultService, KeyType } from '../../security/KeyVaultService';
import { AuthService } from '../../users/AuthService';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error.middleware';
import { validate } from '../middleware/validation.middleware';
import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

const storeKeySchema = z.object({
  keyType: z.enum(['ai_provider', 'exchange', 'webhook', 'other'], {
    errorMap: () => ({ message: 'Invalid key type' }),
  }),
  providerId: z.string().min(1, 'Provider ID is required'),
  key: z.string().min(1, 'API key is required'),
  metadata: z.record(z.string(), z.any()).optional(),
});

const rotateKeySchema = z.object({
  newKey: z.string().min(1, 'New API key is required'),
});

// ============================================================================
// Router Factory
// ============================================================================

export function createKeyVaultRouter(
  keyVault: KeyVaultService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // ============================================================================
  // POST /keys - Store a New Key
  // ============================================================================

  router.post(
    '/keys',
    requireAuth,
    validate(storeKeySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { keyType, providerId, key, metadata } = req.body;

      const storedKey = await keyVault.storeKey({
        userId,
        keyType: keyType as KeyType,
        providerId,
        plaintext: key,
        metadata,
      });

      // Return masked response (never expose encrypted key or plaintext)
      res.status(201).json({
        success: true,
        data: {
          id: storedKey.id,
          keyType: storedKey.keyType,
          providerId: storedKey.providerId,
          keyVersion: storedKey.keyVersion,
          maskedKey: keyVault.maskKey(key),
          metadata: storedKey.metadata,
          createdAt: storedKey.createdAt,
          updatedAt: storedKey.updatedAt,
        },
      });
    })
  );

  // ============================================================================
  // GET /keys - List User Keys
  // ============================================================================

  router.get(
    '/keys',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { keyType, providerId } = req.query;

      const keys = await keyVault.listKeys(userId, {
        keyType: keyType as KeyType | undefined,
        providerId: providerId as string | undefined,
      });

      res.json({
        success: true,
        data: keys,
      });
    })
  );

  // ============================================================================
  // GET /keys/:id - Retrieve Decrypted Key
  // ============================================================================

  router.get(
    '/keys/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      try {
        const retrievedKey = await keyVault.retrieveKey(id, userId);

        res.json({
          success: true,
          data: retrievedKey,
        });
      } catch (error: any) {
        if (error.message === 'Key not found') {
          throw new NotFoundError('Key not found');
        }
        if (error.message === 'Access denied') {
          res.status(403).json({
            success: false,
            error: 'Access denied',
          });
          return;
        }
        throw error;
      }
    })
  );

  // ============================================================================
  // POST /keys/:id/rotate - Rotate API Key
  // ============================================================================

  router.post(
    '/keys/:id/rotate',
    requireAuth,
    validate(rotateKeySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;
      const { newKey } = req.body;

      try {
        const rotatedKey = await keyVault.rotateKey(id, userId, newKey);

        res.json({
          success: true,
          data: {
            id: rotatedKey.id,
            keyType: rotatedKey.keyType,
            providerId: rotatedKey.providerId,
            keyVersion: rotatedKey.keyVersion,
            maskedKey: keyVault.maskKey(newKey),
            updatedAt: rotatedKey.updatedAt,
          },
        });
      } catch (error: any) {
        if (error.message === 'Key not found') {
          throw new NotFoundError('Key not found');
        }
        if (error.message === 'Access denied') {
          res.status(403).json({
            success: false,
            error: 'Access denied',
          });
          return;
        }
        throw error;
      }
    })
  );

  // ============================================================================
  // DELETE /keys/:id - Delete Key
  // ============================================================================

  router.delete(
    '/keys/:id',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;
      const { id } = req.params;

      try {
        await keyVault.deleteKey(id, userId);

        res.json({
          success: true,
          message: 'Key deleted successfully',
        });
      } catch (error: any) {
        if (error.message === 'Key not found') {
          throw new NotFoundError('Key not found');
        }
        if (error.message === 'Access denied') {
          res.status(403).json({
            success: false,
            error: 'Access denied',
          });
          return;
        }
        throw error;
      }
    })
  );

  // ============================================================================
  // GET /audit - Get Audit Logs
  // ============================================================================

  router.get(
    '/audit',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.userId!;

      const logs = await keyVault.getAuditLogs(userId);

      res.json({
        success: true,
        data: logs,
      });
    })
  );

  return router;
}
