// lib/utils/retry.ts
// API retry utility with exponential backoff

interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any, attempt: number) => boolean;
    onRetry?: (error: any, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryCondition: (error) => {
        // Retry on network errors or 5xx status codes
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return true; // Network error
        }
        if (error.status && error.status >= 500) {
            return true; // Server error
        }
        if (error.status === 429) {
            return true; // Rate limited
        }
        return false;
    },
    onRetry: () => {},
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with jitter
 */
function calculateDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number
): number {
    const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    // Add jitter (±25%)
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(cappedDelay + jitter);
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Check if we should retry
            if (attempt === opts.maxAttempts || !opts.retryCondition(error, attempt)) {
                throw error;
            }

            // Calculate delay
            const delayMs = calculateDelay(
                attempt,
                opts.initialDelayMs,
                opts.maxDelayMs,
                opts.backoffMultiplier
            );

            // Notify about retry
            opts.onRetry(error, attempt, delayMs);

            // Wait before next attempt
            await sleep(delayMs);
        }
    }

    throw lastError;
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function retryFetch(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
): Promise<Response> {
    return retry(async () => {
        const response = await fetch(url, options);
        
        // Throw on error status codes to trigger retry
        if (!response.ok) {
            const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.response = response;
            throw error;
        }
        
        return response;
    }, {
        ...retryOptions,
        retryCondition: (error) => {
            // Don't retry on 4xx errors (except 429)
            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                return false;
            }
            return DEFAULT_OPTIONS.retryCondition(error, 0);
        },
    });
}

/**
 * Create a retry wrapper for API calls
 */
export function createRetryableApi<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
): T {
    return ((...args: Parameters<T>) => {
        return retry(() => fn(...args), options);
    }) as T;
}

/**
 * Retry decorator (for class methods)
 */
export function Retryable(options: RetryOptions = {}) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            return retry(() => originalMethod.apply(this, args), options);
        };

        return descriptor;
    };
}

// Export types
export type { RetryOptions };
