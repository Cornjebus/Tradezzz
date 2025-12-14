-- ============================================================================
-- Neural Trading Platform - Add Clerk ID Migration
-- Version: 002
-- Description: Adds clerk_id column for Clerk authentication integration
-- ============================================================================

-- Add clerk_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE;

-- Create index for clerk_id lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Record migration
INSERT INTO migrations (name) VALUES ('002_add_clerk_id');
