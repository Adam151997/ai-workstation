// lib/workflow/engine.ts
// Workflow execution engine with audit trail and observability
// Updated for PostgreSQL persistence (Phase 0)

import { v4 as uuidv4 } from 'uuid';
import { workflowStore } from '../db/workflow-store';
import {
    WorkflowExecution,
    WorkflowStep,
    AuditLog,
    BillingRecord,
} from '../db/schema';

export interface WorkflowPlan {
    name: string;
    description: string;
    steps: {
        name: string;
        description: string;
        tool?: string;
        parameters?: Record<string, any>;
    }[];
}

export class WorkflowEngine {
    private executionId: string;
    private userId: string;
    private mode: 'Sales' | 'Marketing' | 'Admin';
    private modelId: string;
    
    constructor(
        userId: string,
        mode: 'Sales' | 'Marketing' | 'Admin',
        modelId: string
    ) {
        this.executionId = uuidv4();
        this.userId = userId;
        this.mode = mode;
        this.modelId = modelId;
    }

    /**
     * Start a new workflow execution
     */
    async startWorkflow(plan: WorkflowPlan): Promise<string> {
        const execution: WorkflowExecution = {
            execution_id: this.executionId,
            workflow_name: plan.name,
            workflow_type: 'autonomous',
            user_id: this.userId,
            mode: this.mode,
            model_id: this.modelId,
            start_time: new Date().toISOString(),
            status: 'running',
            total_cost: 0,
            total_tokens: 0,
            steps_total: plan.steps.length,
            steps_completed: 0,
            steps_failed: 0,
            metadata: {
                description: plan.description,
                created_at: new Date().toISOString(),
            },
        };

        // Persist to PostgreSQL
        await workflowStore.createExecution(execution);

        // Create audit log for workflow start
        await this.logAudit({
            action_type: 'workflow_start',
            action_details: `Started workflow: ${plan.name}`,
            success: true,
            metadata: {
                steps_total: plan.steps.length,
                workflow_type: 'autonomous',
            },
        });

        console.log(`[Engine] 🚀 Started workflow: ${this.executionId}`);
        
        return this.executionId;
    }

    /**
     * Execute a single step
     */
    async executeStep(
        stepNumber: number,
        stepName: string,
        stepDescription: string,
        toolName?: string,
        toolParameters?: Record<string, any>
    ): Promise<WorkflowStep> {
        const stepId = uuidv4();
        const step: WorkflowStep = {
            step_id: stepId,
            execution_id: this.executionId,
            step_number: stepNumber,
            step_name: stepName,
            step_description: stepDescription,
            tool_name: toolName,
            tool_parameters: toolParameters,
            status: 'running',
            start_time: new Date().toISOString(),
            tokens_used: 0,
            cost: 0,
            retry_count: 0,
        };

        // Persist to PostgreSQL
        await workflowStore.addStep(this.executionId, step);

        // Audit log for step start
        await this.logAudit({
            step_id: stepId,
            action_type: 'step_start',
            action_details: `Step ${stepNumber}: ${stepName}`,
            tool_name: toolName,
            success: true,
            metadata: {
                step_description: stepDescription,
            },
        });

        console.log(`[Engine] ▶️ Step ${stepNumber}: ${stepName}`);

        return step;
    }

    /**
     * Log a tool call for audit purposes
     */
    async logToolCall(
        stepId: string,
        toolName: string,
        toolInput: Record<string, any>,
        toolOutput: any,
        tokensUsed: number = 0,
        cost: number = 0,
        success: boolean = true,
        errorMessage?: string
    ): Promise<void> {
        await this.logAudit({
            step_id: stepId,
            action_type: 'tool_call',
            action_details: `Tool call: ${toolName}`,
            tool_name: toolName,
            tool_input: toolInput,
            tool_output: toolOutput,
            tokens_used: tokensUsed,
            cost,
            success,
            error_message: errorMessage,
            metadata: {},
        });
    }

    /**
     * Log an AI decision for audit purposes
     */
    async logAIDecision(
        stepId: string,
        decision: string,
        reasoning: string,
        tokensUsed: number = 0,
        cost: number = 0
    ): Promise<void> {
        await this.logAudit({
            step_id: stepId,
            action_type: 'ai_decision',
            action_details: decision,
            tokens_used: tokensUsed,
            cost,
            success: true,
            metadata: {
                reasoning,
            },
        });
    }

    /**
     * Complete a step with result
     */
    async completeStep(
        stepId: string,
        success: boolean,
        result?: any,
        tokensUsed: number = 0,
        cost: number = 0,
        errorMessage?: string
    ): Promise<void> {
        const endTime = new Date().toISOString();
        const steps = await workflowStore.getSteps(this.executionId);
        const step = steps.find(s => s.step_id === stepId);
        
        if (!step) {
            console.error(`[Engine] ❌ Step not found: ${stepId}`);
            return;
        }

        const durationMs = step.start_time 
            ? new Date(endTime).getTime() - new Date(step.start_time).getTime()
            : 0;

        const updates: Partial<WorkflowStep> = {
            status: success ? 'success' : 'failed',
            end_time: endTime,
            duration_ms: durationMs,
            result,
            error_message: errorMessage,
            tokens_used: tokensUsed,
            cost,
        };

        // Update step in PostgreSQL
        await workflowStore.updateStep(this.executionId, stepId, updates);

        // Update execution totals
        const execution = await workflowStore.getExecution(this.executionId);
        if (execution) {
            await workflowStore.updateExecution(this.executionId, {
                steps_completed: success 
                    ? execution.steps_completed + 1 
                    : execution.steps_completed,
                steps_failed: success 
                    ? execution.steps_failed 
                    : execution.steps_failed + 1,
                total_tokens: execution.total_tokens + tokensUsed,
                total_cost: execution.total_cost + cost,
            });
        }

        // Audit log for step completion
        await this.logAudit({
            step_id: stepId,
            action_type: 'step_end',
            action_details: success 
                ? `Step completed: ${step.step_name}`
                : `Step failed: ${step.step_name}`,
            tool_name: step.tool_name,
            tool_output: result,
            tokens_used: tokensUsed,
            cost,
            success,
            error_message: errorMessage,
            metadata: {
                duration_ms: durationMs,
            },
        });

        console.log(`[Engine] ${success ? '✅' : '❌'} Step ${step.step_number}: ${step.step_name} (${durationMs}ms, $${cost.toFixed(4)})`);
    }

    /**
     * Retry a failed step
     */
    async retryStep(stepId: string): Promise<void> {
        const steps = await workflowStore.getSteps(this.executionId);
        const step = steps.find(s => s.step_id === stepId);
        
        if (!step) {
            console.error(`[Engine] ❌ Step not found for retry: ${stepId}`);
            return;
        }

        await workflowStore.updateStep(this.executionId, stepId, {
            status: 'running',
            start_time: new Date().toISOString(),
            end_time: undefined,
            retry_count: step.retry_count + 1,
            error_message: undefined,
        });

        await this.logAudit({
            step_id: stepId,
            action_type: 'retry',
            action_details: `Retrying step: ${step.step_name} (attempt ${step.retry_count + 2})`,
            success: true,
            metadata: {
                retry_count: step.retry_count + 1,
            },
        });

        console.log(`[Engine] 🔄 Retrying step ${step.step_number}: ${step.step_name}`);
    }

    /**
     * Complete the entire workflow
     */
    async completeWorkflow(status: 'success' | 'failed' | 'partial' | 'cancelled', errorMessage?: string): Promise<void> {
        const endTime = new Date().toISOString();
        const execution = await workflowStore.getExecution(this.executionId);
        
        if (!execution) {
            console.error(`[Engine] ❌ Execution not found: ${this.executionId}`);
            return;
        }

        const durationMs = new Date(endTime).getTime() - new Date(execution.start_time).getTime();

        // Update execution in PostgreSQL
        await workflowStore.updateExecution(this.executionId, {
            status,
            end_time: endTime,
            error_message: errorMessage,
        });

        // Audit log for workflow completion
        await this.logAudit({
            action_type: 'workflow_end',
            action_details: `Workflow ${status}: ${execution.workflow_name}`,
            success: status === 'success',
            error_message: errorMessage,
            metadata: {
                duration_ms: durationMs,
                total_steps: execution.steps_total,
                completed_steps: execution.steps_completed,
                failed_steps: execution.steps_failed,
            },
        });

        // Create billing record
        await this.createBillingRecord(execution);

        console.log(`[Engine] 🏁 Workflow ${status}: ${execution.workflow_name} (${durationMs}ms, $${execution.total_cost.toFixed(4)})`);
    }

    /**
     * Cancel a running workflow
     */
    async cancelWorkflow(reason?: string): Promise<void> {
        await this.completeWorkflow('cancelled', reason || 'Cancelled by user');
    }

    // Private helper methods

    private async logAudit(params: {
        step_id?: string;
        action_type: AuditLog['action_type'];
        action_details: string;
        tool_name?: string;
        tool_input?: Record<string, any>;
        tool_output?: any;
        tokens_used?: number;
        cost?: number;
        success: boolean;
        error_message?: string;
        metadata?: Record<string, any>;
    }): Promise<void> {
        const log: AuditLog = {
            log_id: uuidv4(),
            execution_id: this.executionId,
            step_id: params.step_id,
            timestamp: new Date().toISOString(),
            user_id: this.userId,
            action_type: params.action_type,
            action_details: params.action_details,
            tool_name: params.tool_name,
            tool_input: params.tool_input,
            tool_output: params.tool_output,
            tokens_used: params.tokens_used || 0,
            cost: params.cost || 0,
            model_id: this.modelId,
            success: params.success,
            error_message: params.error_message,
            metadata: params.metadata || {},
        };

        // Persist to PostgreSQL
        await workflowStore.addAuditLog(this.executionId, log);
    }

    private async createBillingRecord(execution: WorkflowExecution): Promise<void> {
        const now = new Date();
        const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const record: BillingRecord = {
            billing_id: uuidv4(),
            user_id: this.userId,
            execution_id: this.executionId,
            timestamp: new Date().toISOString(),
            model_id: this.modelId,
            tokens_input: Math.floor(execution.total_tokens * 0.6), // Estimate
            tokens_output: Math.floor(execution.total_tokens * 0.4), // Estimate
            tokens_total: execution.total_tokens,
            cost: execution.total_cost,
            billing_period: billingPeriod,
            paid: false,
        };

        // Persist to PostgreSQL
        await workflowStore.addBillingRecord(record);
    }

    getExecutionId(): string {
        return this.executionId;
    }

    /**
     * Get current execution status
     */
    async getExecutionStatus(): Promise<WorkflowExecution | undefined> {
        return await workflowStore.getExecution(this.executionId);
    }

    /**
     * Get all steps for current execution
     */
    async getSteps(): Promise<WorkflowStep[]> {
        return await workflowStore.getSteps(this.executionId);
    }

    /**
     * Get audit logs for current execution
     */
    async getAuditLogs(): Promise<AuditLog[]> {
        return await workflowStore.getAuditLogs(this.executionId);
    }
}

// ========================================
// Static helper functions
// ========================================

/**
 * Get all executions for a user
 */
export async function getUserExecutions(userId: string, limit?: number): Promise<WorkflowExecution[]> {
    return await workflowStore.getAllExecutions(userId, limit);
}

/**
 * Get running executions for a user
 */
export async function getRunningExecutions(userId: string): Promise<WorkflowExecution[]> {
    return await workflowStore.getRunningExecutions(userId);
}

/**
 * Get execution details by ID
 */
export async function getExecutionDetails(executionId: string): Promise<{
    execution: WorkflowExecution | undefined;
    steps: WorkflowStep[];
    logs: AuditLog[];
}> {
    const [execution, steps, logs] = await Promise.all([
        workflowStore.getExecution(executionId),
        workflowStore.getSteps(executionId),
        workflowStore.getAuditLogs(executionId),
    ]);

    return { execution, steps, logs };
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string) {
    return await workflowStore.getStats(userId);
}

/**
 * Get cost breakdown by mode
 */
export async function getCostByMode(userId: string) {
    return await workflowStore.getCostByMode(userId);
}

/**
 * Get all audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit?: number): Promise<AuditLog[]> {
    return await workflowStore.getAllAuditLogs(userId, limit);
}

/**
 * Get billing summary
 */
export async function getBillingSummary(userId: string, billingPeriod: string) {
    return await workflowStore.getBillingSummary(userId, billingPeriod);
}
