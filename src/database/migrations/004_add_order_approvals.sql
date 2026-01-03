-- ============================================================================
-- Migration 004 - Order Approvals for Neon Live Trading
-- Description: Adds order_approvals table to support manual approval flow
-- ============================================================================

CREATE TABLE order_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('market', 'limit', 'stop_loss', 'take_profit')),
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('paper', 'live')),
    exchange_connection_id UUID REFERENCES exchange_connections(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_approvals_user_id ON order_approvals(user_id);
CREATE INDEX idx_order_approvals_strategy_id ON order_approvals(strategy_id);
CREATE INDEX idx_order_approvals_status ON order_approvals(status);
CREATE INDEX idx_order_approvals_created_at ON order_approvals(created_at DESC);

INSERT INTO migrations (name) VALUES ('004_add_order_approvals');

