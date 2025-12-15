/**
 * DataPrivacyService - Phase 13: Data Privacy & Export (GDPR)
 *
 * Handles GDPR compliance:
 * - Data export (right to portability)
 * - Data deletion (right to erasure)
 * - Data retention policies
 * - Consent management
 */

export type ExportFormat = 'json' | 'csv';

export interface UserProfile {
  id: string;
  email: string;
  tier: string;
  createdAt: Date;
}

export interface Strategy {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: Date;
}

export interface ExchangeConnection {
  id: string;
  exchange: string;
  name: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface AIProvider {
  id: string;
  provider: string;
  name: string;
  apiKey?: string;
}

export interface UserData {
  profile: UserProfile;
  strategies: Strategy[];
  trades: Trade[];
  settings: Record<string, any>;
  disclaimerAcceptances: Array<{ version: string; acceptedAt: Date }>;
  exchangeConnections: ExchangeConnection[];
  aiProviders: AIProvider[];
}

export interface UserDataExport {
  profile: UserProfile;
  strategies: Strategy[];
  trades: Trade[];
  settings: Record<string, any>;
  disclaimerAcceptances: Array<{ version: string; acceptedAt: Date }>;
  exchangeConnections: Array<Omit<ExchangeConnection, 'apiKey' | 'apiSecret'>>;
  aiProviders: Array<Omit<AIProvider, 'apiKey'>>;
  exportMetadata: {
    exportedAt: Date;
    version: string;
    userId: string;
  };
}

export interface DeleteConfirmation {
  confirmation: string;
  password: string;
}

export interface DeleteResult {
  success: boolean;
  deletedItems: string[];
  timestamp: Date;
}

export interface DeletionLog {
  userId: string;
  deletedAt: Date;
  itemsDeleted: number;
}

export interface RetentionPolicy {
  retentionDays: number;
  reason: string;
}

export interface ConsentRecord {
  marketing: boolean;
  analytics: boolean;
  thirdPartySharing: boolean;
  recordedAt?: Date;
}

export interface PrivacyInfo {
  dataController: string;
  purposes: string[];
  legalBasis: string;
  rights: string[];
}

export class DataPrivacyService {
  private userData: Map<string, UserData> = new Map();
  private deletionLogs: DeletionLog[] = [];
  private anonymizedData: Map<string, { trades: Array<Trade & { userId: string }> }> = new Map();
  private consentRecords: Map<string, ConsentRecord> = new Map();

  /**
   * Set user data (for testing/initialization)
   */
  setUserData(userId: string, data: UserData): void {
    this.userData.set(userId, data);
  }

  /**
   * Export all user data (GDPR right to portability)
   */
  async exportUserData(
    userId: string,
    options?: { format?: ExportFormat }
  ): Promise<UserDataExport> {
    const userData = this.userData.get(userId);
    if (!userData) {
      throw new Error('User not found');
    }

    // Remove sensitive data from export
    const safeExchangeConnections = userData.exchangeConnections.map(conn => ({
      id: conn.id,
      exchange: conn.exchange,
      name: conn.name
    }));

    const safeAiProviders = userData.aiProviders.map(provider => ({
      id: provider.id,
      provider: provider.provider,
      name: provider.name
    }));

    return {
      profile: userData.profile,
      strategies: userData.strategies,
      trades: userData.trades,
      settings: userData.settings,
      disclaimerAcceptances: userData.disclaimerAcceptances,
      exchangeConnections: safeExchangeConnections,
      aiProviders: safeAiProviders,
      exportMetadata: {
        exportedAt: new Date(),
        version: '1.0',
        userId
      }
    };
  }

  /**
   * Export trades as CSV
   */
  async exportTradesAsCsv(userId: string): Promise<string> {
    const userData = this.userData.get(userId);
    if (!userData) {
      throw new Error('User not found');
    }

    const headers = 'id,symbol,side,quantity,price,timestamp';
    const rows = userData.trades.map(trade =>
      `${trade.id},${trade.symbol},${trade.side},${trade.quantity},${trade.price},${trade.timestamp.toISOString()}`
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Delete all user data (GDPR right to erasure)
   */
  async deleteUserData(
    userId: string,
    confirmation: DeleteConfirmation
  ): Promise<DeleteResult> {
    const userData = this.userData.get(userId);
    if (!userData) {
      throw new Error('User not found');
    }

    // Validate confirmation phrase
    if (confirmation.confirmation !== 'DELETE MY DATA') {
      throw new Error('Confirmation phrase must be "DELETE MY DATA"');
    }

    // Validate password
    if (!confirmation.password) {
      throw new Error('Password required for account deletion');
    }

    // Anonymize trade data for regulatory retention
    const anonymizedTrades = userData.trades.map(trade => ({
      ...trade,
      userId: `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
    this.anonymizedData.set(userId, { trades: anonymizedTrades });

    // Track what we're deleting
    const deletedItems: string[] = [];

    if (userData.profile) deletedItems.push('profile');
    if (userData.strategies.length > 0) deletedItems.push('strategies');
    if (userData.trades.length > 0) deletedItems.push('trades');
    if (Object.keys(userData.settings).length > 0) deletedItems.push('settings');
    if (userData.exchangeConnections.length > 0) deletedItems.push('exchangeConnections');
    if (userData.aiProviders.length > 0) deletedItems.push('aiProviders');

    // Log the deletion
    this.deletionLogs.push({
      userId,
      deletedAt: new Date(),
      itemsDeleted: deletedItems.length
    });

    // Delete the data
    this.userData.delete(userId);
    this.consentRecords.delete(userId);

    return {
      success: true,
      deletedItems,
      timestamp: new Date()
    };
  }

  /**
   * Get deletion logs
   */
  getDeletionLogs(): DeletionLog[] {
    return [...this.deletionLogs];
  }

  /**
   * Get anonymized data for a deleted user
   */
  getAnonymizedData(userId: string): { trades: Array<Trade & { userId: string }> } | undefined {
    return this.anonymizedData.get(userId);
  }

  /**
   * Get data retention policies
   */
  getRetentionPolicies(): Record<string, RetentionPolicy> {
    return {
      trades: {
        retentionDays: 2555, // ~7 years for regulatory compliance
        reason: 'Financial regulatory requirements mandate 7-year trade record retention'
      },
      auditLogs: {
        retentionDays: 730, // 2 years
        reason: 'Security and compliance audit requirements'
      },
      deletedUserData: {
        retentionDays: 30,
        reason: 'Grace period for accidental deletion recovery'
      },
      sessionData: {
        retentionDays: 30,
        reason: 'Security analysis and fraud prevention'
      },
      analyticsData: {
        retentionDays: 365,
        reason: 'Product improvement and usage analysis'
      }
    };
  }

  /**
   * Get categories of data collected
   */
  getDataCategories(): string[] {
    return [
      'profile',
      'strategies',
      'trades',
      'settings',
      'exchange_connections',
      'ai_providers',
      'audit_logs',
      'disclaimer_acceptances',
      'session_data'
    ];
  }

  /**
   * Get privacy policy information
   */
  getPrivacyInfo(): PrivacyInfo {
    return {
      dataController: 'Tradezzz Platform',
      purposes: [
        'Provide trading platform services',
        'Process and execute trades',
        'Maintain account security',
        'Comply with legal obligations',
        'Improve platform features'
      ],
      legalBasis: 'Contract performance, Legal obligation, Legitimate interests',
      rights: [
        'access',
        'rectification',
        'erasure',
        'portability',
        'restriction',
        'objection'
      ]
    };
  }

  /**
   * Record user consent preferences
   */
  recordConsent(userId: string, consent: Omit<ConsentRecord, 'recordedAt'>): void {
    this.consentRecords.set(userId, {
      ...consent,
      recordedAt: new Date()
    });
  }

  /**
   * Get user consent preferences
   */
  getConsent(userId: string): ConsentRecord {
    return this.consentRecords.get(userId) || {
      marketing: false,
      analytics: false,
      thirdPartySharing: false
    };
  }
}
