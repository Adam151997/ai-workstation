// lib/billing/billing-store.ts
// Billing and usage tracking data layer

import { query } from '@/lib/db';

// ============================================
// Types
// ============================================

export interface SubscriptionTier {
    tierId: string;
    name: string;
    displayName: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    tokensPerMonth: number;
    requestsPerDay: number;
    requestsPerMinute: number;
    maxDocuments: number;
    maxProjects: number;
    maxFileSizeMb: number;
    features: string[];
    isActive: boolean;
}

export interface UserSubscription {
    subscriptionId: string;
    userId: string;
    tierId: string;
    tierName: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
    billingPeriod: 'monthly' | 'yearly';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}

export interface UsageRecord {
    recordId: string;
    userId: string;
    usageType: 'chat' | 'embedding' | 'tool_call' | 'document_upload' | 'api_request';
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    cost: number;
    modelId?: string;
    mode?: string;
    toolName?: string;
    createdAt: Date;
}

export interface UsageAggregate {
    userId: string;
    date: Date;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    chatRequests: number;
    chatTokens: number;
    embeddingRequests: number;
    toolCalls: number;
    documentUploads: number;
}

export interface UsageSummary {
    currentPeriod: {
        start: Date;
        end: Date;
        tokensUsed: number;
        tokensLimit: number;
        tokensPercentage: number;
        requestsToday: number;
        requestsLimit: number;
        requestsPercentage: number;
        totalCost: number;
    };
    today: {
        requests: number;
        tokens: number;
        cost: number;
    };
    thisMonth: {
        requests: number;
        tokens: number;
        cost: number;
    };
}

export interface RateLimitStatus {
    allowed: boolean;
    currentCount: number;
    limit: number;
    resetAt: Date;
    windowType: 'minute' | 'day' | 'month';
}

// ============================================
// Subscription Tiers
// ============================================

export async function getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    const rows = await query(
        `SELECT * FROM subscription_tiers WHERE is_active = true ORDER BY sort_order`
    );

    return rows.map(row => ({
        tierId: row.tier_id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        priceYearly: parseFloat(row.price_yearly),
        tokensPerMonth: parseInt(row.tokens_per_month),
        requestsPerDay: row.requests_per_day,
        requestsPerMinute: row.requests_per_minute,
        maxDocuments: row.max_documents,
        maxProjects: row.max_projects,
        maxFileSizeMb: row.max_file_size_mb,
        features: row.features || [],
        isActive: row.is_active,
    }));
}

export async function getTierByName(name: string): Promise<SubscriptionTier | null> {
    const rows = await query(
        `SELECT * FROM subscription_tiers WHERE name = $1`,
        [name]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
        tierId: row.tier_id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        priceMonthly: parseFloat(row.price_monthly),
        priceYearly: parseFloat(row.price_yearly),
        tokensPerMonth: parseInt(row.tokens_per_month),
        requestsPerDay: row.requests_per_day,
        requestsPerMinute: row.requests_per_minute,
        maxDocuments: row.max_documents,
        maxProjects: row.max_projects,
        maxFileSizeMb: row.max_file_size_mb,
        features: row.features || [],
        isActive: row.is_active,
    };
}

// ============================================
// User Subscriptions
// ============================================

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const rows = await query(
        `SELECT us.*, st.name as tier_name
         FROM user_subscriptions us
         JOIN subscription_tiers st ON us.tier_id = st.tier_id
         WHERE us.user_id = $1 AND us.status = 'active'
         LIMIT 1`,
        [userId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
        subscriptionId: row.subscription_id,
        userId: row.user_id,
        tierId: row.tier_id,
        tierName: row.tier_name,
        status: row.status,
        billingPeriod: row.billing_period,
        currentPeriodStart: new Date(row.current_period_start),
        currentPeriodEnd: new Date(row.current_period_end),
        cancelAtPeriodEnd: row.cancel_at_period_end,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
    };
}

export async function createUserSubscription(
    userId: string,
    tierName: string = 'free',
    billingPeriod: 'monthly' | 'yearly' = 'monthly'
): Promise<UserSubscription> {
    const tier = await getTierByName(tierName);
    if (!tier) throw new Error(`Tier not found: ${tierName}`);

    const periodEnd = billingPeriod === 'yearly'
        ? `NOW() + INTERVAL '1 year'`
        : `NOW() + INTERVAL '1 month'`;

    const rows = await query(
        `INSERT INTO user_subscriptions (user_id, tier_id, billing_period, current_period_end)
         VALUES ($1, $2, $3, ${periodEnd})
         ON CONFLICT (user_id) DO UPDATE SET
            tier_id = $2,
            billing_period = $3,
            current_period_start = NOW(),
            current_period_end = ${periodEnd},
            updated_at = NOW()
         RETURNING *`,
        [userId, tier.tierId, billingPeriod]
    );

    const row = rows[0];
    return {
        subscriptionId: row.subscription_id,
        userId: row.user_id,
        tierId: row.tier_id,
        tierName: tierName,
        status: row.status,
        billingPeriod: row.billing_period,
        currentPeriodStart: new Date(row.current_period_start),
        currentPeriodEnd: new Date(row.current_period_end),
        cancelAtPeriodEnd: row.cancel_at_period_end,
    };
}

export async function getUserTierLimits(userId: string): Promise<SubscriptionTier> {
    // Try to get user's subscription
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
        const tier = await query(
            `SELECT * FROM subscription_tiers WHERE tier_id = $1`,
            [subscription.tierId]
        );
        if (tier.length > 0) {
            const row = tier[0];
            return {
                tierId: row.tier_id,
                name: row.name,
                displayName: row.display_name,
                description: row.description,
                priceMonthly: parseFloat(row.price_monthly),
                priceYearly: parseFloat(row.price_yearly),
                tokensPerMonth: parseInt(row.tokens_per_month),
                requestsPerDay: row.requests_per_day,
                requestsPerMinute: row.requests_per_minute,
                maxDocuments: row.max_documents,
                maxProjects: row.max_projects,
                maxFileSizeMb: row.max_file_size_mb,
                features: row.features || [],
                isActive: row.is_active,
            };
        }
    }

    // Default to free tier
    const freeTier = await getTierByName('free');
    if (!freeTier) {
        // Fallback defaults
        return {
            tierId: 'default',
            name: 'free',
            displayName: 'Free',
            description: 'Free tier',
            priceMonthly: 0,
            priceYearly: 0,
            tokensPerMonth: 50000,
            requestsPerDay: 50,
            requestsPerMinute: 5,
            maxDocuments: 10,
            maxProjects: 2,
            maxFileSizeMb: 5,
            features: [],
            isActive: true,
        };
    }
    return freeTier;
}

// ============================================
// Usage Tracking
// ============================================

export async function recordUsage(params: {
    userId: string;
    usageType: 'chat' | 'embedding' | 'tool_call' | 'document_upload' | 'api_request';
    tokensInput?: number;
    tokensOutput?: number;
    cost?: number;
    modelId?: string;
    mode?: string;
    toolName?: string;
    requestId?: string;
    durationMs?: number;
    success?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
}): Promise<void> {
    const {
        userId,
        usageType,
        tokensInput = 0,
        tokensOutput = 0,
        cost = 0,
        modelId,
        mode,
        toolName,
        requestId,
        durationMs,
        success = true,
        errorMessage,
        metadata = {},
    } = params;

    try {
        await query(
            `INSERT INTO usage_records (
                user_id, usage_type, tokens_input, tokens_output, cost,
                model_id, mode, tool_name, request_id, duration_ms,
                success, error_message, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                userId, usageType, tokensInput, tokensOutput, cost,
                modelId, mode, toolName, requestId, durationMs,
                success, errorMessage, JSON.stringify(metadata)
            ]
        );

        // Also update rate limit windows (fire and forget)
        query(`SELECT increment_rate_limit($1, 'minute', $2)`, [userId, tokensInput + tokensOutput]).catch(() => {});
        query(`SELECT increment_rate_limit($1, 'day', $2)`, [userId, tokensInput + tokensOutput]).catch(() => {});
        query(`SELECT increment_rate_limit($1, 'month', $2)`, [userId, tokensInput + tokensOutput]).catch(() => {});
    } catch (error) {
        console.error('[Billing] Failed to record usage:', error);
        // Don't throw - usage tracking should not break the main flow
    }
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
    // Get user's tier limits
    const tier = await getUserTierLimits(userId);

    // Get today's usage
    const todayResult = await query(
        `SELECT 
            COALESCE(SUM(total_requests), 0) as requests,
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(total_cost), 0) as cost
         FROM usage_aggregates
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId]
    );

    // Get this month's usage
    const monthResult = await query(
        `SELECT 
            COALESCE(SUM(total_requests), 0) as requests,
            COALESCE(SUM(total_tokens), 0) as tokens,
            COALESCE(SUM(total_cost), 0) as cost
         FROM usage_aggregates
         WHERE user_id = $1 AND date >= date_trunc('month', CURRENT_DATE)`,
        [userId]
    );

    const today = todayResult[0] || { requests: 0, tokens: 0, cost: 0 };
    const month = monthResult[0] || { requests: 0, tokens: 0, cost: 0 };

    const tokensUsed = parseInt(month.tokens) || 0;
    const requestsToday = parseInt(today.requests) || 0;

    return {
        currentPeriod: {
            start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
            tokensUsed,
            tokensLimit: tier.tokensPerMonth,
            tokensPercentage: tier.tokensPerMonth > 0 ? (tokensUsed / tier.tokensPerMonth) * 100 : 0,
            requestsToday,
            requestsLimit: tier.requestsPerDay,
            requestsPercentage: tier.requestsPerDay > 0 ? (requestsToday / tier.requestsPerDay) * 100 : 0,
            totalCost: parseFloat(month.cost) || 0,
        },
        today: {
            requests: parseInt(today.requests) || 0,
            tokens: parseInt(today.tokens) || 0,
            cost: parseFloat(today.cost) || 0,
        },
        thisMonth: {
            requests: parseInt(month.requests) || 0,
            tokens: parseInt(month.tokens) || 0,
            cost: parseFloat(month.cost) || 0,
        },
    };
}

export async function getUsageHistory(
    userId: string,
    days: number = 30
): Promise<UsageAggregate[]> {
    const rows = await query(
        `SELECT * FROM usage_aggregates
         WHERE user_id = $1 AND date >= CURRENT_DATE - $2::INTEGER
         ORDER BY date DESC`,
        [userId, days]
    );

    return rows.map(row => ({
        userId: row.user_id,
        date: new Date(row.date),
        totalRequests: row.total_requests,
        totalTokens: row.total_tokens,
        totalCost: parseFloat(row.total_cost),
        chatRequests: row.chat_requests,
        chatTokens: row.chat_tokens,
        embeddingRequests: row.embedding_requests,
        toolCalls: row.tool_calls,
        documentUploads: row.document_uploads,
    }));
}

// ============================================
// Rate Limiting
// ============================================

export async function checkRateLimit(
    userId: string,
    windowType: 'minute' | 'day' | 'month'
): Promise<RateLimitStatus> {
    const tier = await getUserTierLimits(userId);
    
    let limit: number;
    let windowMs: number;
    
    switch (windowType) {
        case 'minute':
            limit = tier.requestsPerMinute;
            windowMs = 60 * 1000;
            break;
        case 'day':
            limit = tier.requestsPerDay;
            windowMs = 24 * 60 * 60 * 1000;
            break;
        case 'month':
            limit = tier.tokensPerMonth;
            windowMs = 30 * 24 * 60 * 60 * 1000;
            break;
    }

    // Get current window count
    const result = await query(
        `SELECT request_count, token_count, window_end
         FROM rate_limit_windows
         WHERE user_id = $1 
           AND window_type = $2 
           AND window_start = date_trunc($2, NOW())
         LIMIT 1`,
        [userId, windowType]
    );

    const currentCount = result.length > 0 
        ? (windowType === 'month' ? result[0].token_count : result[0].request_count)
        : 0;

    const resetAt = result.length > 0 
        ? new Date(result[0].window_end)
        : new Date(Date.now() + windowMs);

    return {
        allowed: currentCount < limit,
        currentCount,
        limit,
        resetAt,
        windowType,
    };
}

export async function checkAllRateLimits(userId: string): Promise<{
    allowed: boolean;
    limits: RateLimitStatus[];
    blockedBy?: RateLimitStatus;
}> {
    const minuteLimit = await checkRateLimit(userId, 'minute');
    const dayLimit = await checkRateLimit(userId, 'day');
    const monthLimit = await checkRateLimit(userId, 'month');

    const limits = [minuteLimit, dayLimit, monthLimit];
    const blockedBy = limits.find(l => !l.allowed);

    return {
        allowed: !blockedBy,
        limits,
        blockedBy,
    };
}

// ============================================
// Billing Periods
// ============================================

export async function getCurrentBillingPeriod(userId: string): Promise<any> {
    const tier = await getUserTierLimits(userId);
    
    const result = await query(
        `SELECT * FROM billing_periods
         WHERE user_id = $1 AND status = 'active'
         ORDER BY period_start DESC
         LIMIT 1`,
        [userId]
    );

    if (result.length === 0) {
        // Create a new billing period
        const newPeriod = await query(
            `INSERT INTO billing_periods (user_id, period_start, period_end, token_limit, request_limit)
             VALUES ($1, date_trunc('month', CURRENT_DATE), date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', $2, $3)
             RETURNING *`,
            [userId, tier.tokensPerMonth, tier.requestsPerDay * 30]
        );
        return newPeriod[0];
    }

    return result[0];
}

export async function getBillingHistory(userId: string, limit: number = 12): Promise<any[]> {
    const rows = await query(
        `SELECT * FROM billing_periods
         WHERE user_id = $1
         ORDER BY period_start DESC
         LIMIT $2`,
        [userId, limit]
    );
    return rows;
}

export default {
    getSubscriptionTiers,
    getTierByName,
    getUserSubscription,
    createUserSubscription,
    getUserTierLimits,
    recordUsage,
    getUsageSummary,
    getUsageHistory,
    checkRateLimit,
    checkAllRateLimits,
    getCurrentBillingPeriod,
    getBillingHistory,
};
