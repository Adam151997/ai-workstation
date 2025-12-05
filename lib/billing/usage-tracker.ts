// lib/billing/usage-tracker.ts
// Utility for tracking usage in API endpoints

import { recordUsage, checkAllRateLimits, getUserTierLimits } from './billing-store';

// ============================================
// Cost Calculation
// ============================================

// Cost per 1K tokens for different models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
    // Groq models (very cheap)
    'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
    'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
    'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
    'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
    'gemma2-9b-it': { input: 0.0002, output: 0.0002 },
    
    // OpenAI models
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    
    // Embedding models
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
    'text-embedding-ada-002': { input: 0.0001, output: 0 },
    
    // Default
    'default': { input: 0.001, output: 0.002 },
};

export function calculateCost(
    modelId: string,
    tokensInput: number,
    tokensOutput: number
): number {
    const costs = MODEL_COSTS[modelId] || MODEL_COSTS['default'];
    return (tokensInput / 1000) * costs.input + (tokensOutput / 1000) * costs.output;
}

// ============================================
// Usage Tracking Wrapper
// ============================================

export interface TrackUsageParams {
    userId: string;
    usageType: 'chat' | 'embedding' | 'tool_call' | 'document_upload' | 'api_request';
    modelId?: string;
    mode?: string;
    toolName?: string;
    requestId?: string;
    metadata?: Record<string, any>;
}

export interface TrackUsageResult {
    recordId?: string;
    tokensInput: number;
    tokensOutput: number;
    cost: number;
    durationMs: number;
}

/**
 * Higher-order function to track usage for an async operation
 */
export async function trackUsage<T>(
    params: TrackUsageParams,
    operation: () => Promise<{ result: T; tokensInput: number; tokensOutput: number }>
): Promise<{ result: T; usage: TrackUsageResult }> {
    const startTime = Date.now();
    
    try {
        const { result, tokensInput, tokensOutput } = await operation();
        const durationMs = Date.now() - startTime;
        const cost = calculateCost(params.modelId || 'default', tokensInput, tokensOutput);
        
        // Record usage (fire and forget)
        recordUsage({
            ...params,
            tokensInput,
            tokensOutput,
            cost,
            durationMs,
            success: true,
        }).catch(console.error);
        
        return {
            result,
            usage: {
                tokensInput,
                tokensOutput,
                cost,
                durationMs,
            },
        };
    } catch (error: any) {
        const durationMs = Date.now() - startTime;
        
        // Record failed usage
        recordUsage({
            ...params,
            tokensInput: 0,
            tokensOutput: 0,
            cost: 0,
            durationMs,
            success: false,
            errorMessage: error.message,
        }).catch(console.error);
        
        throw error;
    }
}

/**
 * Simple usage recording (for cases where you already have the token counts)
 */
export async function trackSimpleUsage(params: {
    userId: string;
    usageType: 'chat' | 'embedding' | 'tool_call' | 'document_upload' | 'api_request';
    tokensInput: number;
    tokensOutput: number;
    modelId?: string;
    mode?: string;
    toolName?: string;
    durationMs?: number;
    success?: boolean;
    metadata?: Record<string, any>;
}): Promise<void> {
    const cost = calculateCost(
        params.modelId || 'default',
        params.tokensInput,
        params.tokensOutput
    );
    
    await recordUsage({
        ...params,
        cost,
    });
}

// ============================================
// Rate Limit Checking
// ============================================

export interface RateLimitCheck {
    allowed: boolean;
    reason?: string;
    resetAt?: Date;
    limits: {
        minute: { current: number; limit: number };
        day: { current: number; limit: number };
        month: { current: number; limit: number };
    };
}

export async function checkUserRateLimits(userId: string): Promise<RateLimitCheck> {
    const result = await checkAllRateLimits(userId);
    
    if (!result.allowed && result.blockedBy) {
        let reason = '';
        switch (result.blockedBy.windowType) {
            case 'minute':
                reason = 'Too many requests per minute. Please slow down.';
                break;
            case 'day':
                reason = 'Daily request limit reached. Upgrade your plan for more requests.';
                break;
            case 'month':
                reason = 'Monthly token limit reached. Upgrade your plan for more tokens.';
                break;
        }
        
        return {
            allowed: false,
            reason,
            resetAt: result.blockedBy.resetAt,
            limits: {
                minute: { current: result.limits[0].currentCount, limit: result.limits[0].limit },
                day: { current: result.limits[1].currentCount, limit: result.limits[1].limit },
                month: { current: result.limits[2].currentCount, limit: result.limits[2].limit },
            },
        };
    }
    
    return {
        allowed: true,
        limits: {
            minute: { current: result.limits[0].currentCount, limit: result.limits[0].limit },
            day: { current: result.limits[1].currentCount, limit: result.limits[1].limit },
            month: { current: result.limits[2].currentCount, limit: result.limits[2].limit },
        },
    };
}

// ============================================
// Limit Checking Utilities
// ============================================

export async function checkDocumentLimit(userId: string, currentCount: number): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
}> {
    const tier = await getUserTierLimits(userId);
    return {
        allowed: currentCount < tier.maxDocuments,
        limit: tier.maxDocuments,
        current: currentCount,
    };
}

export async function checkProjectLimit(userId: string, currentCount: number): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
}> {
    const tier = await getUserTierLimits(userId);
    return {
        allowed: currentCount < tier.maxProjects,
        limit: tier.maxProjects,
        current: currentCount,
    };
}

export async function checkFileSizeLimit(userId: string, fileSizeBytes: number): Promise<{
    allowed: boolean;
    limit: number;
    fileSizeMb: number;
}> {
    const tier = await getUserTierLimits(userId);
    const fileSizeMb = fileSizeBytes / (1024 * 1024);
    return {
        allowed: fileSizeMb <= tier.maxFileSizeMb,
        limit: tier.maxFileSizeMb,
        fileSizeMb,
    };
}

export default {
    calculateCost,
    trackUsage,
    trackSimpleUsage,
    checkUserRateLimits,
    checkDocumentLimit,
    checkProjectLimit,
    checkFileSizeLimit,
};
