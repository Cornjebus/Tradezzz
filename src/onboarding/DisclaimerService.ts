/**
 * DisclaimerService - Phase 11: User Onboarding & Disclaimers
 *
 * Manages legal disclaimers, user acceptance flow, and onboarding progress.
 * Critical for legal compliance - users must accept before trading.
 */

export interface DisclaimerCheckboxes {
  understandRisks: boolean;
  notFinancialAdvice: boolean;
  ownDecisions: boolean;
  canAffordLoss: boolean;
}

export interface DisclaimerAcceptance {
  version: string;
  ipAddress: string;
  userAgent: string;
  checkboxes: DisclaimerCheckboxes;
}

export interface AcceptanceRecord extends DisclaimerAcceptance {
  userId: string;
  acceptedAt: Date;
}

export interface TradePermission {
  allowed: boolean;
  reason?: string;
}

export interface OnboardingProgress {
  steps: string[];
  completedSteps: string[];
  isComplete: boolean;
  percentComplete: number;
}

export interface CheckboxDescriptions {
  understandRisks: string;
  notFinancialAdvice: string;
  ownDecisions: string;
  canAffordLoss: string;
}

const ONBOARDING_STEPS = ['disclaimer', 'profile', 'exchange', 'ai_provider'];

export class DisclaimerService {
  private currentVersion: string = '1.0';
  private acceptances: Map<string, AcceptanceRecord[]> = new Map();
  private completedSteps: Map<string, Set<string>> = new Map();

  /**
   * Get the full disclaimer content
   */
  getDisclaimerContent(): string {
    return `
# Risk Disclaimer & Terms of Use

## Platform Overview

Tradezzz is a research and execution tool for cryptocurrency trading. We provide:
- Strategy building and backtesting tools
- Connection to your exchange accounts
- Integration with your AI provider accounts
- Paper trading simulation

**Important:** We operate under a no custody model. Your funds remain on your exchange.
Your AI costs are paid directly to your AI provider.

## General Risk Warning

**This platform is not financial advice.** We are not a licensed financial advisor,
investment advisor, broker, or dealer. The information and tools provided are for
educational and research purposes only.

**Past performance does not guarantee future results.** Historical backtesting and
simulated results do not reflect actual trading and may not account for market
conditions, slippage, or other factors.

**There is a risk of substantial loss in cryptocurrency trading.** You should only
trade with money you can afford to lose. Cryptocurrency markets are highly volatile
and operate 24/7 market hours.

**You could lose entire investment.** Cryptocurrency trading is not suitable for all
investors. You should carefully consider your investment objectives, level of
experience, and risk appetite.

## Your Responsibilities

**You trade at your own risk.** You are solely responsible for your own trading
decisions. You must do your own research (DYOR) before making any trades.

**You are responsible for your own trading decisions.** The platform provides tools,
not recommendations. Any AI-generated insights are for research purposes only.

## API Key Security

Your API key security is critical. When connecting exchange accounts:

- **Never enable withdrawal permissions** on API keys used with this platform
- Use **trade-only API keys** with appropriate restrictions
- Regularly rotate your API keys
- We encrypt your keys, but you should still limit permissions

## Platform Disclaimers

- This is a research and execution tool only
- We have no custody of your funds at any time
- Trading occurs on your exchange with your exchange's terms
- AI analysis uses your AI provider with your AI provider's terms
- We are not responsible for exchange outages, API issues, or AI provider errors

## Acceptance

By using this platform, you acknowledge that you have read, understood, and agree
to these terms. You confirm that cryptocurrency trading involves substantial risk
and that you are solely responsible for your trading decisions.

Version: ${this.currentVersion}
Last Updated: ${new Date().toISOString().split('T')[0]}
    `.trim();
  }

  /**
   * Get the current disclaimer version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Set the current version (for testing version upgrades)
   */
  setCurrentVersion(version: string): void {
    this.currentVersion = version;
  }

  /**
   * Check if a user can trade
   */
  canUserTrade(userId: string): TradePermission {
    const userAcceptances = this.acceptances.get(userId);

    if (!userAcceptances || userAcceptances.length === 0) {
      return {
        allowed: false,
        reason: 'You must accept risk disclaimer before trading'
      };
    }

    // Get the latest acceptance
    const latestAcceptance = userAcceptances[userAcceptances.length - 1];

    // Check if version is still valid
    const acceptedMajor = parseInt(latestAcceptance.version.split('.')[0]);
    const currentMajor = parseInt(this.currentVersion.split('.')[0]);

    if (acceptedMajor < currentMajor) {
      return {
        allowed: false,
        reason: 'You must accept the updated disclaimer (major version change)'
      };
    }

    return { allowed: true };
  }

  /**
   * Accept the disclaimer
   */
  acceptDisclaimer(userId: string, acceptance: DisclaimerAcceptance): void {
    // Validate all checkboxes are checked
    const { checkboxes } = acceptance;
    if (
      !checkboxes.understandRisks ||
      !checkboxes.notFinancialAdvice ||
      !checkboxes.ownDecisions ||
      !checkboxes.canAffordLoss
    ) {
      throw new Error('All checkboxes must be acknowledged');
    }

    // Record the acceptance
    const record: AcceptanceRecord = {
      ...acceptance,
      userId,
      acceptedAt: new Date()
    };

    const userAcceptances = this.acceptances.get(userId) || [];
    userAcceptances.push(record);
    this.acceptances.set(userId, userAcceptances);

    // Mark disclaimer step as complete
    this.completeStep(userId, 'disclaimer');
  }

  /**
   * Get the acceptance record for a user
   */
  getAcceptanceRecord(userId: string): AcceptanceRecord | undefined {
    const userAcceptances = this.acceptances.get(userId);
    if (!userAcceptances || userAcceptances.length === 0) {
      return undefined;
    }
    return userAcceptances[userAcceptances.length - 1];
  }

  /**
   * Get full acceptance history for a user
   */
  getAcceptanceHistory(userId: string): AcceptanceRecord[] {
    return this.acceptances.get(userId) || [];
  }

  /**
   * Get descriptions for each checkbox
   */
  getCheckboxDescriptions(): CheckboxDescriptions {
    return {
      understandRisks: 'I understand that cryptocurrency trading involves substantial risk of loss and may not be suitable for all investors.',
      notFinancialAdvice: 'I understand that this platform does not provide financial advice and all AI-generated insights are for research purposes only.',
      ownDecisions: 'I am responsible for my own trading decisions and will do my own research before trading.',
      canAffordLoss: 'I confirm that I am only trading with money I can afford to lose.'
    };
  }

  // ============================================
  // ONBOARDING METHODS
  // ============================================

  /**
   * Complete an onboarding step
   */
  completeStep(userId: string, step: string): void {
    if (!ONBOARDING_STEPS.includes(step)) {
      throw new Error(`Invalid onboarding step: ${step}`);
    }

    const userSteps = this.completedSteps.get(userId) || new Set();
    userSteps.add(step);
    this.completedSteps.set(userId, userSteps);
  }

  /**
   * Get onboarding progress for a user
   */
  getOnboardingProgress(userId: string): OnboardingProgress {
    const userSteps = this.completedSteps.get(userId) || new Set();
    const completedSteps = Array.from(userSteps);

    return {
      steps: [...ONBOARDING_STEPS],
      completedSteps,
      isComplete: completedSteps.length === ONBOARDING_STEPS.length,
      percentComplete: Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100)
    };
  }

  /**
   * Get the next incomplete step
   */
  getNextStep(userId: string): string | null {
    const userSteps = this.completedSteps.get(userId) || new Set();

    for (const step of ONBOARDING_STEPS) {
      if (!userSteps.has(step)) {
        return step;
      }
    }

    return null; // All complete
  }

  /**
   * Check if a specific step is complete
   */
  isStepComplete(userId: string, step: string): boolean {
    const userSteps = this.completedSteps.get(userId) || new Set();
    return userSteps.has(step);
  }

  /**
   * Reset onboarding for a user (for testing)
   */
  resetOnboarding(userId: string): void {
    this.completedSteps.delete(userId);
    this.acceptances.delete(userId);
  }
}
