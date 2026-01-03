-- Phase 18: AI Key Security - KeyVault Tables
-- Secure storage for encrypted API keys with audit logging

-- ============================================================================
-- API Keys Table
-- Stores encrypted API keys for AI providers, exchanges, webhooks, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_type TEXT NOT NULL CHECK (key_type IN ('ai_provider', 'exchange', 'webhook', 'other')),
    provider_id TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can have only one key per provider/type combination
    UNIQUE (user_id, key_type, provider_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_type ON api_keys(user_id, key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider_id);

-- ============================================================================
-- Audit Logs Table
-- Tracks all key access, modifications, and security events
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_id UUID,
    action TEXT NOT NULL CHECK (action IN ('key_stored', 'key_retrieved', 'key_rotated', 'key_deleted', 'access_denied')),
    details JSONB,
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_key_id ON audit_logs(key_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_keys IS 'Secure encrypted storage for API keys (AI providers, exchanges, webhooks)';
COMMENT ON TABLE audit_logs IS 'Audit trail for all key vault operations';

COMMENT ON COLUMN api_keys.encrypted_key IS 'AES-256-GCM encrypted API key - never store plaintext';
COMMENT ON COLUMN api_keys.key_version IS 'Incremented on each key rotation for tracking';
COMMENT ON COLUMN audit_logs.action IS 'Type of operation: key_stored, key_retrieved, key_rotated, key_deleted, access_denied';
