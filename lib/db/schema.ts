// lib/db/schema.ts
// Database schema for workflow execution, audit trails, and observability
// Updated for PostgreSQL persistence (Phase 0)

export interface WorkflowExecution {
    execution_id: string;
    workflow_name: string;
    workflow_type: 'autonomous' | 'manual' | 'template';
    user_id: string;
    mode: 'Sales' | 'Marketing' | 'Admin';
    model_id: string;
    start_time: string; // ISO 8601
    end_time?: string; // ISO 8601
    status: 'running' | 'success' | 'failed' | 'partial' | 'cancelled';
    total_cost: number; // USD
    total_tokens: number;
    steps_total: number;
    steps_completed: number;
    steps_failed: number;
    error_message?: string;
    metadata: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

export interface WorkflowStep {
    step_id: string;
    execution_id: string;
    step_number: number;
    step_name: string;
    step_description?: string;
    tool_name?: string;
    tool_parameters?: Record<string, any>;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    start_time?: string;
    end_time?: string;
    duration_ms?: number;
    tokens_used: number;
    cost: number;
    result?: any;
    error_message?: string;
    retry_count: number;
    created_at?: string;
    updated_at?: string;
}

export interface AuditLog {
    log_id: string;
    execution_id: string;
    step_id?: string;
    timestamp: string; // ISO 8601
    user_id: string;
    action_type: 'workflow_start' | 'workflow_end' | 'step_start' | 'step_end' | 
                 'tool_call' | 'ai_decision' | 'error' | 'retry' | 'user_intervention';
    action_details: string;
    tool_name?: string;
    tool_input?: Record<string, any>;
    tool_output?: any;
    tokens_used: number;
    cost: number;
    model_id: string;
    success: boolean;
    error_message?: string;
    metadata: Record<string, any>;
    created_at?: string;
}

export interface ObservabilityMetrics {
    metric_id: string;
    timestamp: string;
    user_id: string;
    metric_type: 'token_usage' | 'cost' | 'execution_time' | 'error_rate' | 
                 'tool_success_rate' | 'workflow_success_rate';
    metric_value: number;
    aggregation_period: 'minute' | 'hour' | 'day' | 'week' | 'month';
    dimensions: Record<string, string>; // e.g., {model: 'gpt-4', mode: 'Sales'}
    created_at?: string;
}

export interface BillingRecord {
    billing_id: string;
    user_id: string;
    execution_id: string;
    timestamp: string;
    model_id: string;
    tokens_input: number;
    tokens_output: number;
    tokens_total: number;
    cost: number;
    billing_period: string; // e.g., '2024-12'
    paid: boolean;
    payment_id?: string; // Stripe payment ID if applicable
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

// ========================================
// Type Guards
// ========================================

export const isWorkflowRunning = (execution: WorkflowExecution): boolean => {
    return execution.status === 'running';
};

export const isWorkflowComplete = (execution: WorkflowExecution): boolean => {
    return ['success', 'failed', 'partial', 'cancelled'].includes(execution.status);
};

export const isStepComplete = (step: WorkflowStep): boolean => {
    return step.status === 'success' || step.status === 'failed' || step.status === 'skipped';
};

export const isStepRunning = (step: WorkflowStep): boolean => {
    return step.status === 'running';
};

// ========================================
// Calculation Helpers
// ========================================

export const calculateWorkflowCost = (steps: WorkflowStep[]): number => {
    return steps.reduce((total, step) => total + step.cost, 0);
};

export const calculateWorkflowTokens = (steps: WorkflowStep[]): number => {
    return steps.reduce((total, step) => total + step.tokens_used, 0);
};

export const calculateSuccessRate = (executions: WorkflowExecution[]): number => {
    if (executions.length === 0) return 0;
    const successful = executions.filter(e => e.status === 'success').length;
    return (successful / executions.length) * 100;
};

export const calculateAverageExecutionTime = (executions: WorkflowExecution[]): number => {
    const completed = executions.filter(e => e.end_time);
    if (completed.length === 0) return 0;
    
    const totalMs = completed.reduce((sum, e) => {
        const start = new Date(e.start_time).getTime();
        const end = new Date(e.end_time!).getTime();
        return sum + (end - start);
    }, 0);
    
    return totalMs / completed.length;
};

// ========================================
// Formatting Helpers
// ========================================

export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
};

export const formatCost = (cost: number): string => {
    if (cost >= 1) {
        return `$${cost.toFixed(2)}`;
    } else if (cost >= 0.01) {
        return `$${cost.toFixed(4)}`;
    } else {
        return `$${cost.toFixed(6)}`;
    }
};

export const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
};

// ========================================
// Billing Period Helpers
// ========================================

export const getCurrentBillingPeriod = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const parseBillingPeriod = (period: string): { year: number; month: number } => {
    const [year, month] = period.split('-').map(Number);
    return { year, month };
};

export const formatBillingPeriod = (period: string): string => {
    const { year, month } = parseBillingPeriod(period);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};
