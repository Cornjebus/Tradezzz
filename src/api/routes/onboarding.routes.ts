/**
 * Onboarding API Routes - Phase 11: User Onboarding & Disclaimers
 *
 * Endpoints for user onboarding flow and disclaimer acceptance
 */

import { Router, Request, Response } from 'express';
import { DisclaimerService } from '../../onboarding/DisclaimerService';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Singleton instance (in production, inject via DI)
const disclaimerService = new DisclaimerService();

/**
 * GET /api/onboarding/disclaimer
 * Get the current disclaimer content
 */
router.get('/disclaimer', async (req: Request, res: Response) => {
  try {
    const content = disclaimerService.getDisclaimerContent();
    const version = disclaimerService.getCurrentVersion();
    const checkboxes = disclaimerService.getCheckboxDescriptions();

    res.json({
      success: true,
      data: {
        content,
        version,
        checkboxes
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
 * GET /api/onboarding/disclaimer/status
 * Check if user has accepted current disclaimer
 */
router.get('/disclaimer/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const canTrade = disclaimerService.canUserTrade(userId);
    const acceptance = disclaimerService.getAcceptanceRecord(userId);

    res.json({
      success: true,
      data: {
        hasAccepted: canTrade.allowed,
        reason: canTrade.reason,
        lastAcceptance: acceptance ? {
          version: acceptance.version,
          acceptedAt: acceptance.acceptedAt
        } : null,
        currentVersion: disclaimerService.getCurrentVersion()
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
 * POST /api/onboarding/disclaimer/accept
 * Accept the disclaimer
 */
router.post('/disclaimer/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { checkboxes } = req.body;

    if (!checkboxes) {
      return res.status(400).json({
        success: false,
        error: 'Checkboxes are required'
      });
    }

    // Get IP and user agent for audit trail
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    disclaimerService.acceptDisclaimer(userId, {
      version: disclaimerService.getCurrentVersion(),
      ipAddress,
      userAgent,
      checkboxes
    });

    res.json({
      success: true,
      message: 'Disclaimer accepted successfully',
      data: {
        canTrade: disclaimerService.canUserTrade(userId).allowed
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/onboarding/disclaimer/history
 * Get user's disclaimer acceptance history
 */
router.get('/disclaimer/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const history = disclaimerService.getAcceptanceHistory(userId);

    // Remove sensitive data from response
    const safeHistory = history.map(record => ({
      version: record.version,
      acceptedAt: record.acceptedAt,
      // Don't expose IP in response for privacy
    }));

    res.json({
      success: true,
      data: safeHistory
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// ONBOARDING PROGRESS ENDPOINTS
// ============================================

/**
 * GET /api/onboarding/progress
 * Get user's onboarding progress
 */
router.get('/progress', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const progress = disclaimerService.getOnboardingProgress(userId);

    res.json({
      success: true,
      data: progress
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/onboarding/next-step
 * Get the next step in onboarding
 */
router.get('/next-step', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const nextStep = disclaimerService.getNextStep(userId);
    const progress = disclaimerService.getOnboardingProgress(userId);

    res.json({
      success: true,
      data: {
        nextStep,
        isComplete: progress.isComplete,
        percentComplete: progress.percentComplete
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
 * POST /api/onboarding/complete-step
 * Mark an onboarding step as complete
 */
router.post('/complete-step', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { step } = req.body;

    if (!step) {
      return res.status(400).json({
        success: false,
        error: 'Step name is required'
      });
    }

    // Don't allow completing 'disclaimer' via this endpoint
    // It should be completed via the accept endpoint
    if (step === 'disclaimer') {
      return res.status(400).json({
        success: false,
        error: 'Use /disclaimer/accept to complete the disclaimer step'
      });
    }

    disclaimerService.completeStep(userId, step);
    const progress = disclaimerService.getOnboardingProgress(userId);

    res.json({
      success: true,
      message: `Step '${step}' completed`,
      data: {
        nextStep: disclaimerService.getNextStep(userId),
        progress
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/onboarding/can-trade
 * Quick check if user can trade
 */
router.get('/can-trade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const canTrade = disclaimerService.canUserTrade(userId);

    res.json({
      success: true,
      data: canTrade
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
