import { describe, it, expect, beforeEach } from 'vitest';
import { DataPrivacyService, ExportFormat, UserDataExport } from './DataPrivacyService';

describe('DataPrivacyService', () => {
  let service: DataPrivacyService;

  beforeEach(() => {
    service = new DataPrivacyService();
  });

  describe('Data Export', () => {
    beforeEach(() => {
      // Set up test user data
      service.setUserData('user_1', {
        profile: {
          id: 'user_1',
          email: 'test@example.com',
          tier: 'pro',
          createdAt: new Date('2024-01-15')
        },
        strategies: [
          { id: 'strat_1', name: 'Momentum', type: 'momentum', status: 'active' },
          { id: 'strat_2', name: 'Mean Reversion', type: 'mean_reversion', status: 'draft' }
        ],
        trades: [
          { id: 'trade_1', symbol: 'BTC/USDT', side: 'buy', quantity: 0.5, price: 50000, timestamp: new Date() },
          { id: 'trade_2', symbol: 'ETH/USDT', side: 'sell', quantity: 2, price: 3000, timestamp: new Date() }
        ],
        settings: {
          timezone: 'UTC',
          notificationsEnabled: true,
          riskLevel: 'medium'
        },
        disclaimerAcceptances: [
          { version: '1.0', acceptedAt: new Date('2024-01-15') }
        ],
        exchangeConnections: [
          { id: 'conn_1', exchange: 'binance', name: 'My Binance', apiKey: 'secret_key_123', apiSecret: 'secret_123' }
        ],
        aiProviders: [
          { id: 'ai_1', provider: 'openai', name: 'My OpenAI', apiKey: 'sk-secret' }
        ]
      });
    });

    it('should_export_all_user_data', async () => {
      const exportData = await service.exportUserData('user_1');

      expect(exportData.profile).toBeDefined();
      expect(exportData.strategies).toBeDefined();
      expect(exportData.trades).toBeDefined();
      expect(exportData.settings).toBeDefined();
      expect(exportData.disclaimerAcceptances).toBeDefined();
    });

    it('should_include_trade_history', async () => {
      const exportData = await service.exportUserData('user_1');

      expect(exportData.trades.length).toBe(2);
      expect(exportData.trades[0]).toHaveProperty('symbol');
      expect(exportData.trades[0]).toHaveProperty('side');
      expect(exportData.trades[0]).toHaveProperty('quantity');
      expect(exportData.trades[0]).toHaveProperty('price');
      expect(exportData.trades[0]).toHaveProperty('timestamp');
    });

    it('should_exclude_sensitive_data_from_export', async () => {
      const exportData = await service.exportUserData('user_1');

      // Should not include API keys
      expect(exportData.exchangeConnections).toBeDefined();
      expect(exportData.exchangeConnections[0].apiKey).toBeUndefined();
      expect(exportData.exchangeConnections[0].apiSecret).toBeUndefined();
      expect(exportData.exchangeConnections[0].exchange).toBe('binance');

      // Should not include AI API keys
      expect(exportData.aiProviders).toBeDefined();
      expect(exportData.aiProviders[0].apiKey).toBeUndefined();
      expect(exportData.aiProviders[0].provider).toBe('openai');
    });

    it('should_export_in_json_format', async () => {
      const exportData = await service.exportUserData('user_1', { format: 'json' });

      expect(() => JSON.parse(JSON.stringify(exportData))).not.toThrow();
    });

    it('should_export_trades_in_csv_format', async () => {
      const csvExport = await service.exportTradesAsCsv('user_1');

      expect(csvExport).toContain('id,symbol,side,quantity,price,timestamp');
      expect(csvExport).toContain('BTC/USDT');
      expect(csvExport).toContain('ETH/USDT');
    });

    it('should_include_export_metadata', async () => {
      const exportData = await service.exportUserData('user_1');

      expect(exportData.exportMetadata).toBeDefined();
      expect(exportData.exportMetadata.exportedAt).toBeDefined();
      expect(exportData.exportMetadata.version).toBe('1.0');
      expect(exportData.exportMetadata.userId).toBe('user_1');
    });

    it('should_throw_for_nonexistent_user', async () => {
      await expect(
        service.exportUserData('nonexistent_user')
      ).rejects.toThrow('User not found');
    });
  });

  describe('Data Deletion', () => {
    beforeEach(() => {
      service.setUserData('user_1', {
        profile: { id: 'user_1', email: 'test@example.com', tier: 'free', createdAt: new Date() },
        strategies: [{ id: 'strat_1', name: 'Test', type: 'momentum', status: 'active' }],
        trades: [{ id: 'trade_1', symbol: 'BTC/USDT', side: 'buy', quantity: 1, price: 50000, timestamp: new Date() }],
        settings: {},
        disclaimerAcceptances: [],
        exchangeConnections: [],
        aiProviders: []
      });
    });

    it('should_delete_all_user_data', async () => {
      const result = await service.deleteUserData('user_1', {
        confirmation: 'DELETE MY DATA',
        password: 'user_password'
      });

      expect(result.success).toBe(true);
      expect(result.deletedItems).toContain('profile');
      expect(result.deletedItems).toContain('strategies');
      expect(result.deletedItems).toContain('trades');

      // Verify user data is gone
      await expect(service.exportUserData('user_1')).rejects.toThrow('User not found');
    });

    it('should_require_confirmation_phrase', async () => {
      await expect(
        service.deleteUserData('user_1', {
          confirmation: 'wrong phrase',
          password: 'user_password'
        })
      ).rejects.toThrow('Confirmation phrase must be "DELETE MY DATA"');
    });

    it('should_require_password', async () => {
      await expect(
        service.deleteUserData('user_1', {
          confirmation: 'DELETE MY DATA'
          // Missing password
        } as any)
      ).rejects.toThrow('Password required');
    });

    it('should_create_deletion_audit_log', async () => {
      await service.deleteUserData('user_1', {
        confirmation: 'DELETE MY DATA',
        password: 'user_password'
      });

      const logs = service.getDeletionLogs();
      const userLog = logs.find(l => l.userId === 'user_1');

      expect(userLog).toBeDefined();
      expect(userLog?.deletedAt).toBeDefined();
      expect(userLog?.itemsDeleted).toBeGreaterThan(0);
    });

    it('should_throw_for_nonexistent_user', async () => {
      await expect(
        service.deleteUserData('nonexistent', {
          confirmation: 'DELETE MY DATA',
          password: 'password'
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('Data Retention', () => {
    it('should_define_retention_policies', () => {
      const policies = service.getRetentionPolicies();

      expect(policies.trades).toBeDefined();
      expect(policies.auditLogs).toBeDefined();
      expect(policies.deletedUserData).toBeDefined();
    });

    it('should_have_trade_retention_period', () => {
      const policies = service.getRetentionPolicies();

      // Trades kept for 7 years (regulatory)
      expect(policies.trades.retentionDays).toBe(2555); // ~7 years
      expect(policies.trades.reason).toContain('regulatory');
    });

    it('should_have_audit_log_retention', () => {
      const policies = service.getRetentionPolicies();

      // Audit logs kept for 2 years
      expect(policies.auditLogs.retentionDays).toBe(730);
    });

    it('should_anonymize_deleted_user_data', async () => {
      service.setUserData('user_1', {
        profile: { id: 'user_1', email: 'real@email.com', tier: 'pro', createdAt: new Date() },
        strategies: [],
        trades: [{ id: 'trade_1', symbol: 'BTC/USDT', side: 'buy', quantity: 1, price: 50000, timestamp: new Date() }],
        settings: {},
        disclaimerAcceptances: [],
        exchangeConnections: [],
        aiProviders: []
      });

      await service.deleteUserData('user_1', {
        confirmation: 'DELETE MY DATA',
        password: 'password'
      });

      // Check that anonymized trade data is retained
      const anonymizedData = service.getAnonymizedData('user_1');
      expect(anonymizedData).toBeDefined();
      expect(anonymizedData?.trades.length).toBe(1);
      expect(anonymizedData?.trades[0].userId).not.toBe('user_1');
      expect(anonymizedData?.trades[0].userId).toContain('anon_');
    });
  });

  describe('Privacy Rights', () => {
    it('should_list_data_categories_collected', () => {
      const categories = service.getDataCategories();

      expect(categories).toContain('profile');
      expect(categories).toContain('strategies');
      expect(categories).toContain('trades');
      expect(categories).toContain('settings');
      expect(categories).toContain('exchange_connections');
      expect(categories).toContain('ai_providers');
      expect(categories).toContain('audit_logs');
    });

    it('should_provide_privacy_policy_info', () => {
      const info = service.getPrivacyInfo();

      expect(info.dataController).toBeDefined();
      expect(info.purposes).toBeDefined();
      expect(info.legalBasis).toBeDefined();
      expect(info.rights).toContain('access');
      expect(info.rights).toContain('rectification');
      expect(info.rights).toContain('erasure');
      expect(info.rights).toContain('portability');
    });

    it('should_track_data_processing_consent', () => {
      service.setUserData('user_1', {
        profile: { id: 'user_1', email: 'test@example.com', tier: 'free', createdAt: new Date() },
        strategies: [],
        trades: [],
        settings: {},
        disclaimerAcceptances: [],
        exchangeConnections: [],
        aiProviders: []
      });

      service.recordConsent('user_1', {
        marketing: false,
        analytics: true,
        thirdPartySharing: false
      });

      const consent = service.getConsent('user_1');
      expect(consent.marketing).toBe(false);
      expect(consent.analytics).toBe(true);
      expect(consent.thirdPartySharing).toBe(false);
    });
  });
});
