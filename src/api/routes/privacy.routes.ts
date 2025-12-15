/**
 * Privacy API Routes - Phase 13: Data Privacy & Export (GDPR)
 *
 * Endpoints for GDPR compliance:
 * - Data export
 * - Data deletion
 * - Consent management
 */

import { Router, Request, Response } from 'express';
import { DataPrivacyService } from '../../privacy/DataPrivacyService';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const privacyService = new DataPrivacyService();

/**
 * GET /api/privacy/export
 * Export all user data (GDPR right to portability)
 */
router.get('/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const format = (req.query.format as 'json' | 'csv') || 'json';

    const exportData = await privacyService.exportUserData(userId, { format });

    res.json({
      success: true,
      data: exportData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/privacy/export/trades/csv
 * Export trades as CSV
 */
router.get('/export/trades/csv', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const csvData = await privacyService.exportTradesAsCsv(userId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=trades.csv');
    res.send(csvData);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/privacy/account
 * Delete all user data (GDPR right to erasure)
 */
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { confirmation, password } = req.body;

    if (!confirmation || !password) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation phrase and password required'
      });
    }

    const result = await privacyService.deleteUserData(userId, {
      confirmation,
      password
    });

    res.json({
      success: true,
      message: 'Account and all data deleted successfully',
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/privacy/policies
 * Get data retention policies
 */
router.get('/policies', async (req: Request, res: Response) => {
  try {
    const policies = privacyService.getRetentionPolicies();
    const categories = privacyService.getDataCategories();

    res.json({
      success: true,
      data: {
        retentionPolicies: policies,
        dataCategories: categories
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/privacy/info
 * Get privacy policy information
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const info = privacyService.getPrivacyInfo();

    res.json({
      success: true,
      data: info
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/privacy/consent
 * Get user consent preferences
 */
router.get('/consent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const consent = privacyService.getConsent(userId);

    res.json({
      success: true,
      data: consent
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/privacy/consent
 * Update user consent preferences
 */
router.put('/consent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { marketing, analytics, thirdPartySharing } = req.body;

    privacyService.recordConsent(userId, {
      marketing: !!marketing,
      analytics: !!analytics,
      thirdPartySharing: !!thirdPartySharing
    });

    res.json({
      success: true,
      message: 'Consent preferences updated',
      data: privacyService.getConsent(userId)
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
