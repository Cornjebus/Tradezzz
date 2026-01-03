-- Migration: 007_add_usage_tracking_tables.sql
-- Phase 19: Usage Tracking Tables

-- Usage Records table
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  operation VARCHAR(50) NOT NULL,
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Limits table
CREATE TABLE IF NOT EXISTS usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  daily_token_limit INTEGER NOT NULL DEFAULT 100000,
  daily_cost_limit DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  monthly_token_limit INTEGER DEFAULT 1000000,
  monthly_cost_limit DECIMAL(10,2) DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_provider_id ON usage_records(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_records_provider ON usage_records(user_id, provider);

-- Comments
COMMENT ON TABLE usage_records IS 'Tracks AI provider usage including tokens and costs';
COMMENT ON TABLE usage_limits IS 'User-specific usage limits for cost control';
