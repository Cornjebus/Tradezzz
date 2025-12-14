import { describe, it, expect, beforeEach } from 'vitest';
import { DisclaimerService, DisclaimerCheckboxes, DisclaimerAcceptance } from './DisclaimerService';

describe('DisclaimerService', () => {
  let service: DisclaimerService;

  beforeEach(() => {
    service = new DisclaimerService();
  });

  describe('Disclaimer Content', () => {
    it('should_include_required_legal_text', () => {
      const content = service.getDisclaimerContent().toLowerCase();

      expect(content).toContain('not financial advice');
      expect(content).toContain('not a licensed financial advisor');
      expect(content).toContain('past performance does not guarantee future results');
      expect(content).toContain('risk of substantial loss');
      expect(content).toContain('trade at your own risk');
      expect(content).toContain('responsible for your own trading decisions');
      expect(content).toContain('do your own research');
    });

    it('should_include_api_key_warnings', () => {
      const content = service.getDisclaimerContent().toLowerCase();

      expect(content).toContain('api key security');
      expect(content).toContain('never enable withdrawal permissions');
      expect(content).toContain('trade-only api keys');
    });

    it('should_include_cryptocurrency_specific_risks', () => {
      const content = service.getDisclaimerContent().toLowerCase();

      expect(content).toContain('highly volatile');
      expect(content).toContain('24/7 market');
      expect(content).toContain('lose entire investment');
      expect(content).toContain('not suitable for all'); // May be split across lines
      expect(content).toContain('investors');
    });

    it('should_include_platform_disclaimer', () => {
      const content = service.getDisclaimerContent();

      expect(content).toContain('research and execution tool');
      expect(content).toContain('no custody');
      expect(content).toContain('your exchange');
      expect(content).toContain('your AI provider');
    });

    it('should_have_current_version', () => {
      const version = service.getCurrentVersion();
      expect(version).toMatch(/^\d+\.\d+$/); // e.g., "1.0"
    });
  });

  describe('Acceptance Flow', () => {
    it('should_block_trading_until_accepted', () => {
      const canTrade = service.canUserTrade('user_1');

      expect(canTrade.allowed).toBe(false);
      expect(canTrade.reason).toContain('accept risk disclaimer');
    });

    it('should_allow_trading_after_acceptance', () => {
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      const canTrade = service.canUserTrade('user_1');

      expect(canTrade.allowed).toBe(true);
    });

    it('should_require_all_checkboxes', () => {
      expect(() => {
        service.acceptDisclaimer('user_1', {
          version: '1.0',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          checkboxes: {
            understandRisks: true,
            notFinancialAdvice: true,
            ownDecisions: false, // Not checked
            canAffordLoss: true
          }
        });
      }).toThrow('All checkboxes must be acknowledged');
    });

    it('should_require_understandRisks_checkbox', () => {
      expect(() => {
        service.acceptDisclaimer('user_1', {
          version: '1.0',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          checkboxes: {
            understandRisks: false,
            notFinancialAdvice: true,
            ownDecisions: true,
            canAffordLoss: true
          }
        });
      }).toThrow('All checkboxes must be acknowledged');
    });

    it('should_record_acceptance_with_full_audit_trail', () => {
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Chrome/120',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      const record = service.getAcceptanceRecord('user_1');

      expect(record).toBeDefined();
      expect(record?.version).toBe('1.0');
      expect(record?.ipAddress).toBe('192.168.1.100');
      expect(record?.userAgent).toContain('Chrome');
      expect(record?.acceptedAt).toBeDefined();
      expect(record?.checkboxes).toEqual({
        understandRisks: true,
        notFinancialAdvice: true,
        ownDecisions: true,
        canAffordLoss: true
      });
    });

    it('should_track_multiple_users_separately', () => {
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      expect(service.canUserTrade('user_1').allowed).toBe(true);
      expect(service.canUserTrade('user_2').allowed).toBe(false);
    });
  });

  describe('Version Management', () => {
    it('should_require_re_acceptance_on_major_version_change', () => {
      // Accept v1.0
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      expect(service.canUserTrade('user_1').allowed).toBe(true);

      // Update to v2.0 (major change)
      service.setCurrentVersion('2.0');

      const canTrade = service.canUserTrade('user_1');
      expect(canTrade.allowed).toBe(false);
      expect(canTrade.reason).toContain('updated disclaimer');
    });

    it('should_not_require_re_acceptance_on_minor_version_change', () => {
      // Accept v1.0
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      // Update to v1.1 (minor change)
      service.setCurrentVersion('1.1');

      expect(service.canUserTrade('user_1').allowed).toBe(true);
    });

    it('should_keep_history_of_all_acceptances', () => {
      // Accept v1.0
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      // Update and re-accept v2.0
      service.setCurrentVersion('2.0');
      service.acceptDisclaimer('user_1', {
        version: '2.0',
        ipAddress: '2.2.2.2',
        userAgent: 'Firefox',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      const history = service.getAcceptanceHistory('user_1');
      expect(history.length).toBe(2);
      expect(history[0].version).toBe('1.0');
      expect(history[1].version).toBe('2.0');
    });
  });

  describe('Checkbox Descriptions', () => {
    it('should_provide_checkbox_descriptions', () => {
      const checkboxes = service.getCheckboxDescriptions();

      expect(checkboxes.understandRisks).toContain('risk');
      expect(checkboxes.notFinancialAdvice).toContain('financial advice');
      expect(checkboxes.ownDecisions).toContain('responsible');
      expect(checkboxes.canAffordLoss).toContain('afford to lose');
    });
  });
});

describe('OnboardingService', () => {
  let service: DisclaimerService;

  beforeEach(() => {
    service = new DisclaimerService();
  });

  describe('Onboarding Steps', () => {
    it('should_track_onboarding_progress', () => {
      const progress = service.getOnboardingProgress('user_1');

      expect(progress.steps).toContain('disclaimer');
      expect(progress.steps).toContain('profile');
      expect(progress.steps).toContain('exchange');
      expect(progress.steps).toContain('ai_provider');
      expect(progress.completedSteps).toEqual([]);
      expect(progress.isComplete).toBe(false);
    });

    it('should_mark_disclaimer_step_complete_after_acceptance', () => {
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      const progress = service.getOnboardingProgress('user_1');
      expect(progress.completedSteps).toContain('disclaimer');
    });

    it('should_complete_profile_step', () => {
      service.completeStep('user_1', 'profile');

      const progress = service.getOnboardingProgress('user_1');
      expect(progress.completedSteps).toContain('profile');
    });

    it('should_mark_onboarding_complete_when_all_steps_done', () => {
      // Complete all steps
      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });
      service.completeStep('user_1', 'profile');
      service.completeStep('user_1', 'exchange');
      service.completeStep('user_1', 'ai_provider');

      const progress = service.getOnboardingProgress('user_1');
      expect(progress.isComplete).toBe(true);
    });

    it('should_get_next_incomplete_step', () => {
      const next = service.getNextStep('user_1');
      expect(next).toBe('disclaimer');

      service.acceptDisclaimer('user_1', {
        version: '1.0',
        ipAddress: '1.1.1.1',
        userAgent: 'Chrome',
        checkboxes: {
          understandRisks: true,
          notFinancialAdvice: true,
          ownDecisions: true,
          canAffordLoss: true
        }
      });

      const next2 = service.getNextStep('user_1');
      expect(next2).toBe('profile');
    });
  });
});
