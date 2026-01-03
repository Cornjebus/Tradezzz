-- ============================================================================
-- Migration 005 - Graph Risk Mode on User Settings
-- Description: Adds graph_risk_mode column to user_settings to control
--              how RuVector/graph risk should influence live trading.
-- ============================================================================

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS graph_risk_mode VARCHAR(20) DEFAULT 'warn'
  CHECK (graph_risk_mode IN ('off', 'warn', 'block'));

INSERT INTO migrations (name) VALUES ('005_add_graph_risk_mode');

