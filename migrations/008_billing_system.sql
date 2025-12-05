-- Migration: 008_billing_system.sql
-- Comprehensive billing and usage tracking system
-- Supports tiered pricing, rate limiting, and Stripe integration

-- ============================================
-- 1. Subscription Tiers Table
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
    tier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Pricing
    price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10, 2) NOT NULL DEFAULT 0,
    -- Limits
    tokens_per_month BIGINT NOT NULL DEFAULT 100000,
    requests_per_day INTEGER NOT NULL DEFAULT 100,
    requests_per_minute INTEGER NOT NULL DEFAULT 10,
    max_documents INTEGER NOT NULL DEFAULT 50,
    max_projects INTEGER NOT NULL DEFAULT 5,
    max_file_size_mb INTEGER NOT NULL DEFAULT 10,
    -- Features
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO subscription_tiers (name, display_name, description, price_monthly, price_yearly, tokens_per_month, requests_per_day, requests_per_minute, max_documents, max_projects, max_file_size_mb, features, sort_order)
VALUES 
    ('free', 'Free', 'Get started with basic features', 0, 0, 50000, 50, 5, 10, 2, 5, 
     '["Basic chat", "5 documents", "Community support"]', 1),
    ('pro', 'Pro', 'For professionals and power users', 29.99, 299.99, 500000, 500, 30, 100, 20, 25,
     '["Unlimited chat", "100 documents", "Priority support", "Advanced analytics", "API access"]', 2),
    ('team', 'Team', 'Collaboration features for teams', 79.99, 799.99, 2000000, 2000, 60, 500, 100, 50,
     '["Everything in Pro", "Team collaboration", "Admin dashboard", "SSO", "Dedicated support"]', 3),
    ('enterprise', 'Enterprise', 'Custom solutions for large organizations', 0, 0, 0, 0, 0, 0, 0, 100,
     '["Custom limits", "On-premise option", "SLA guarantee", "Custom integrations", "Account manager"]', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. User Subscriptions Table
-- ============================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    tier_id UUID NOT NULL REFERENCES subscription_tiers(tier_id),
    -- Stripe integration
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing', 'paused'
    -- Billing period
    billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
    current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '1 month',
    -- Trial
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_customer_id);

-- ============================================
-- 3. Usage Records Table (Granular)
-- ============================================

CREATE TABLE IF NOT EXISTS usage_records (
    record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    -- What was used
    usage_type VARCHAR(50) NOT NULL, -- 'chat', 'embedding', 'tool_call', 'document_upload', 'api_request'
    -- Metrics
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
    cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    -- Context
    model_id VARCHAR(100),
    mode VARCHAR(20),
    tool_name VARCHAR(100),
    -- Request tracking
    request_id VARCHAR(100),
    duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_user ON usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_type ON usage_records(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_created ON usage_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_date ON usage_records(user_id, created_at);

-- ============================================
-- 4. Usage Aggregates Table (Daily)
-- ============================================

CREATE TABLE IF NOT EXISTS usage_aggregates (
    aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    -- Aggregated metrics
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens_input INTEGER NOT NULL DEFAULT 0,
    total_tokens_output INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    -- Breakdown by type
    chat_requests INTEGER NOT NULL DEFAULT 0,
    chat_tokens INTEGER NOT NULL DEFAULT 0,
    embedding_requests INTEGER NOT NULL DEFAULT 0,
    embedding_tokens INTEGER NOT NULL DEFAULT 0,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    document_uploads INTEGER NOT NULL DEFAULT 0,
    -- Status
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_user_date ON usage_aggregates(user_id, date DESC);

-- ============================================
-- 5. Billing Periods Table (Monthly)
-- ============================================

CREATE TABLE IF NOT EXISTS billing_periods (
    period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    -- Period boundaries
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Usage totals
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    -- Limits at time of period
    token_limit BIGINT NOT NULL,
    request_limit INTEGER NOT NULL,
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'closed', 'invoiced', 'paid'
    -- Invoice reference
    stripe_invoice_id VARCHAR(100),
    invoice_amount DECIMAL(10, 2),
    invoice_paid_at TIMESTAMP,
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,
    UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_billing_periods_user ON billing_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_periods_status ON billing_periods(status);

-- ============================================
-- 6. Rate Limit Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limit_windows (
    window_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    window_type VARCHAR(20) NOT NULL, -- 'minute', 'day', 'month'
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, window_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_window ON rate_limit_windows(user_id, window_type, window_start);

-- ============================================
-- 7. Payment History Table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_history (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    -- Stripe references
    stripe_payment_intent_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    stripe_charge_id VARCHAR(100),
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL, -- 'succeeded', 'failed', 'pending', 'refunded'
    -- Description
    description TEXT,
    billing_period_id UUID REFERENCES billing_periods(period_id),
    -- Timestamps
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- ============================================
-- 8. Helper Functions
-- ============================================

-- Function to get user's current subscription tier
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id VARCHAR)
RETURNS TABLE (
    tier_name VARCHAR,
    tokens_per_month BIGINT,
    requests_per_day INTEGER,
    requests_per_minute INTEGER,
    max_documents INTEGER,
    max_projects INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.name,
        t.tokens_per_month,
        t.requests_per_day,
        t.requests_per_minute,
        t.max_documents,
        t.max_projects
    FROM user_subscriptions us
    JOIN subscription_tiers t ON us.tier_id = t.tier_id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    LIMIT 1;
    
    -- If no subscription, return free tier
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            t.name,
            t.tokens_per_month,
            t.requests_per_day,
            t.requests_per_minute,
            t.max_documents,
            t.max_projects
        FROM subscription_tiers t
        WHERE t.name = 'free'
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id VARCHAR,
    p_window_type VARCHAR,
    p_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_window_start TIMESTAMP;
    v_current_count INTEGER;
BEGIN
    -- Calculate window start
    CASE p_window_type
        WHEN 'minute' THEN v_window_start := date_trunc('minute', NOW());
        WHEN 'day' THEN v_window_start := date_trunc('day', NOW());
        WHEN 'month' THEN v_window_start := date_trunc('month', NOW());
        ELSE v_window_start := date_trunc('hour', NOW());
    END CASE;
    
    -- Get current count
    SELECT request_count INTO v_current_count
    FROM rate_limit_windows
    WHERE user_id = p_user_id 
      AND window_type = p_window_type 
      AND window_start = v_window_start;
    
    IF v_current_count IS NULL THEN
        v_current_count := 0;
    END IF;
    
    RETURN v_current_count < p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(
    p_user_id VARCHAR,
    p_window_type VARCHAR,
    p_tokens INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    v_window_start TIMESTAMP;
    v_window_end TIMESTAMP;
    v_new_count INTEGER;
BEGIN
    -- Calculate window boundaries
    CASE p_window_type
        WHEN 'minute' THEN 
            v_window_start := date_trunc('minute', NOW());
            v_window_end := v_window_start + INTERVAL '1 minute';
        WHEN 'day' THEN 
            v_window_start := date_trunc('day', NOW());
            v_window_end := v_window_start + INTERVAL '1 day';
        WHEN 'month' THEN 
            v_window_start := date_trunc('month', NOW());
            v_window_end := v_window_start + INTERVAL '1 month';
        ELSE 
            v_window_start := date_trunc('hour', NOW());
            v_window_end := v_window_start + INTERVAL '1 hour';
    END CASE;
    
    -- Upsert the rate limit window
    INSERT INTO rate_limit_windows (user_id, window_type, window_start, window_end, request_count, token_count)
    VALUES (p_user_id, p_window_type, v_window_start, v_window_end, 1, p_tokens)
    ON CONFLICT (user_id, window_type, window_start)
    DO UPDATE SET 
        request_count = rate_limit_windows.request_count + 1,
        token_count = rate_limit_windows.token_count + p_tokens,
        updated_at = NOW()
    RETURNING request_count INTO v_new_count;
    
    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily aggregates
CREATE OR REPLACE FUNCTION update_daily_aggregate(
    p_user_id VARCHAR,
    p_usage_type VARCHAR,
    p_tokens_input INTEGER,
    p_tokens_output INTEGER,
    p_cost DECIMAL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO usage_aggregates (user_id, date, total_requests, total_tokens, total_tokens_input, total_tokens_output, total_cost,
        chat_requests, chat_tokens, embedding_requests, embedding_tokens, tool_calls, document_uploads)
    VALUES (
        p_user_id,
        CURRENT_DATE,
        1,
        p_tokens_input + p_tokens_output,
        p_tokens_input,
        p_tokens_output,
        p_cost,
        CASE WHEN p_usage_type = 'chat' THEN 1 ELSE 0 END,
        CASE WHEN p_usage_type = 'chat' THEN p_tokens_input + p_tokens_output ELSE 0 END,
        CASE WHEN p_usage_type = 'embedding' THEN 1 ELSE 0 END,
        CASE WHEN p_usage_type = 'embedding' THEN p_tokens_input + p_tokens_output ELSE 0 END,
        CASE WHEN p_usage_type = 'tool_call' THEN 1 ELSE 0 END,
        CASE WHEN p_usage_type = 'document_upload' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        total_requests = usage_aggregates.total_requests + 1,
        total_tokens = usage_aggregates.total_tokens + p_tokens_input + p_tokens_output,
        total_tokens_input = usage_aggregates.total_tokens_input + p_tokens_input,
        total_tokens_output = usage_aggregates.total_tokens_output + p_tokens_output,
        total_cost = usage_aggregates.total_cost + p_cost,
        chat_requests = usage_aggregates.chat_requests + CASE WHEN p_usage_type = 'chat' THEN 1 ELSE 0 END,
        chat_tokens = usage_aggregates.chat_tokens + CASE WHEN p_usage_type = 'chat' THEN p_tokens_input + p_tokens_output ELSE 0 END,
        embedding_requests = usage_aggregates.embedding_requests + CASE WHEN p_usage_type = 'embedding' THEN 1 ELSE 0 END,
        embedding_tokens = usage_aggregates.embedding_tokens + CASE WHEN p_usage_type = 'embedding' THEN p_tokens_input + p_tokens_output ELSE 0 END,
        tool_calls = usage_aggregates.tool_calls + CASE WHEN p_usage_type = 'tool_call' THEN 1 ELSE 0 END,
        document_uploads = usage_aggregates.document_uploads + CASE WHEN p_usage_type = 'document_upload' THEN 1 ELSE 0 END,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Triggers
-- ============================================

-- Trigger to update aggregates on usage record insert
CREATE OR REPLACE FUNCTION trigger_update_usage_aggregate()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_daily_aggregate(
        NEW.user_id,
        NEW.usage_type,
        NEW.tokens_input,
        NEW.tokens_output,
        NEW.cost
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_usage_record_aggregate ON usage_records;
CREATE TRIGGER tr_usage_record_aggregate
    AFTER INSERT ON usage_records
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_usage_aggregate();

-- ============================================
-- 10. Clean up old rate limit windows (run periodically)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_windows()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_windows
    WHERE window_end < NOW() - INTERVAL '1 day'
    RETURNING 1 INTO v_deleted;
    
    RETURN COALESCE(v_deleted, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON TABLE subscription_tiers IS 'Available subscription plans with pricing and limits';
COMMENT ON TABLE user_subscriptions IS 'User subscription status and Stripe integration';
COMMENT ON TABLE usage_records IS 'Granular usage tracking for billing';
COMMENT ON TABLE usage_aggregates IS 'Daily aggregated usage for quick queries';
COMMENT ON TABLE billing_periods IS 'Monthly billing periods for invoicing';
COMMENT ON TABLE rate_limit_windows IS 'Sliding window rate limit tracking';
COMMENT ON TABLE payment_history IS 'Payment transaction history';
