-- ============================================================================
-- Migration 003 - Add execution_mode to strategies
-- Description: Adds execution_mode column to strategies for manual vs auto
-- ============================================================================

ALTER TABLE strategies
ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(10) NOT NULL DEFAULT 'manual'
  CHECK (execution_mode IN ('manual', 'auto'));

-- Record migration
INSERT INTO migrations (name, executed_at)
VALUES ('003_add_strategy_execution_mode', NOW())
ON CONFLICT (name) DO NOTHING;

