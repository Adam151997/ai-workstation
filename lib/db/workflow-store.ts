// lib/db/workflow-store.ts
// PostgreSQL-backed workflow store - replaces in-memory implementation
// Phase 0: Foundation Solidification

import { query } from '../db';
import {
    WorkflowExecution,
    WorkflowStep,
    AuditLog,
    ObservabilityMetrics,
    BillingRecord,
} from './schema';

/**
 * PostgreSQL-backed Workflow Store
 * Provides persistent storage for workflow executions, steps, audit logs, and metrics
 */
class PostgresWorkflowStore {
    // ========================================
    // Workflow Executions
    // ========================================

    async createExecution(execution: WorkflowExecution): Promise<void> {
        try {
            await query(
                `INSERT INTO workflow_executions (
                    execution_id, workflow_name, workflow_type, user_id, mode,
                    model_id, start_time, end_time, status, total_cost,
                    total_tokens, steps_total, steps_completed, steps_failed,
                    error_message, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                [
                    execution.execution_id,
                    execution.workflow_name,
                    execution.workflow_type,
                    execution.user_id,
                    execution.mode,
                    execution.model_id,
                    execution.start_time,
                    execution.end_time || null,
                    execution.status,
                    execution.total_cost,
                    execution.total_tokens,
                    execution.steps_total,
                    execution.steps_completed,
                    execution.steps_failed,
                    execution.error_message || null,
                    JSON.stringify(execution.metadata || {}),
                ]
            );
            console.log(`[WorkflowStore] ✅ Created execution: ${execution.execution_id}`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to create execution:`, error);
            throw error;
        }
    }

    async getExecution(executionId: string): Promise<WorkflowExecution | undefined> {
        try {
            const results = await query<WorkflowExecution>(
                `SELECT 
                    execution_id, workflow_name, workflow_type, user_id, mode,
                    model_id, start_time, end_time, status, total_cost,
                    total_tokens, steps_total, steps_completed, steps_failed,
                    error_message, metadata
                FROM workflow_executions 
                WHERE execution_id = $1`,
                [executionId]
            );
            return results[0] || undefined;
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get execution:`, error);
            throw error;
        }
    }

    async updateExecution(executionId: string, updates: Partial<WorkflowExecution>): Promise<void> {
        try {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            // Build dynamic SET clause
            const allowedFields = [
                'status', 'end_time', 'total_cost', 'total_tokens',
                'steps_completed', 'steps_failed', 'error_message', 'metadata'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClauses.push(`${key} = $${paramIndex}`);
                    values.push(key === 'metadata' ? JSON.stringify(value) : value);
                    paramIndex++;
                }
            }

            if (setClauses.length === 0) return;

            values.push(executionId);
            await query(
                `UPDATE workflow_executions SET ${setClauses.join(', ')} WHERE execution_id = $${paramIndex}`,
                values
            );
            console.log(`[WorkflowStore] ✅ Updated execution: ${executionId}`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to update execution:`, error);
            throw error;
        }
    }

    async getAllExecutions(userId?: string, limit: number = 50): Promise<WorkflowExecution[]> {
        try {
            let sql = `
                SELECT 
                    execution_id, workflow_name, workflow_type, user_id, mode,
                    model_id, start_time, end_time, status, total_cost,
                    total_tokens, steps_total, steps_completed, steps_failed,
                    error_message, metadata
                FROM workflow_executions
            `;
            const params: any[] = [];

            if (userId) {
                sql += ` WHERE user_id = $1`;
                params.push(userId);
            }

            sql += ` ORDER BY start_time DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            return await query<WorkflowExecution>(sql, params);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get executions:`, error);
            throw error;
        }
    }

    async getRunningExecutions(userId?: string): Promise<WorkflowExecution[]> {
        try {
            let sql = `
                SELECT * FROM workflow_executions 
                WHERE status = 'running'
            `;
            const params: any[] = [];

            if (userId) {
                sql += ` AND user_id = $1`;
                params.push(userId);
            }

            sql += ` ORDER BY start_time DESC`;

            return await query<WorkflowExecution>(sql, params);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get running executions:`, error);
            throw error;
        }
    }

    // ========================================
    // Workflow Steps
    // ========================================

    async addStep(executionId: string, step: WorkflowStep): Promise<void> {
        try {
            await query(
                `INSERT INTO workflow_steps (
                    step_id, execution_id, step_number, step_name, step_description,
                    tool_name, tool_parameters, status, start_time, end_time,
                    duration_ms, tokens_used, cost, result, error_message, retry_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                [
                    step.step_id,
                    executionId,
                    step.step_number,
                    step.step_name,
                    step.step_description || null,
                    step.tool_name || null,
                    step.tool_parameters ? JSON.stringify(step.tool_parameters) : null,
                    step.status,
                    step.start_time || null,
                    step.end_time || null,
                    step.duration_ms || null,
                    step.tokens_used,
                    step.cost,
                    step.result ? JSON.stringify(step.result) : null,
                    step.error_message || null,
                    step.retry_count,
                ]
            );
            console.log(`[WorkflowStore] ✅ Added step ${step.step_number} to execution: ${executionId}`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to add step:`, error);
            throw error;
        }
    }

    async updateStep(executionId: string, stepId: string, updates: Partial<WorkflowStep>): Promise<void> {
        try {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            const allowedFields = [
                'status', 'start_time', 'end_time', 'duration_ms',
                'tokens_used', 'cost', 'result', 'error_message', 'retry_count'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClauses.push(`${key} = $${paramIndex}`);
                    values.push(key === 'result' ? JSON.stringify(value) : value);
                    paramIndex++;
                }
            }

            if (setClauses.length === 0) return;

            values.push(stepId);
            values.push(executionId);

            await query(
                `UPDATE workflow_steps 
                SET ${setClauses.join(', ')} 
                WHERE step_id = $${paramIndex} AND execution_id = $${paramIndex + 1}`,
                values
            );
            console.log(`[WorkflowStore] ✅ Updated step: ${stepId}`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to update step:`, error);
            throw error;
        }
    }

    async getSteps(executionId: string): Promise<WorkflowStep[]> {
        try {
            return await query<WorkflowStep>(
                `SELECT * FROM workflow_steps 
                WHERE execution_id = $1 
                ORDER BY step_number ASC`,
                [executionId]
            );
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get steps:`, error);
            throw error;
        }
    }

    // ========================================
    // Audit Logs
    // ========================================

    async addAuditLog(executionId: string, log: AuditLog): Promise<void> {
        try {
            await query(
                `INSERT INTO audit_logs (
                    log_id, execution_id, step_id, timestamp, user_id,
                    action_type, action_details, tool_name, tool_input,
                    tool_output, tokens_used, cost, model_id, success,
                    error_message, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
                [
                    log.log_id,
                    executionId,
                    log.step_id || null,
                    log.timestamp,
                    log.user_id,
                    log.action_type,
                    log.action_details,
                    log.tool_name || null,
                    log.tool_input ? JSON.stringify(log.tool_input) : null,
                    log.tool_output ? JSON.stringify(log.tool_output) : null,
                    log.tokens_used,
                    log.cost,
                    log.model_id,
                    log.success,
                    log.error_message || null,
                    JSON.stringify(log.metadata || {}),
                ]
            );
            console.log(`[WorkflowStore] ✅ Added audit log: ${log.action_type}`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to add audit log:`, error);
            throw error;
        }
    }

    async getAuditLogs(executionId: string): Promise<AuditLog[]> {
        try {
            return await query<AuditLog>(
                `SELECT * FROM audit_logs 
                WHERE execution_id = $1 
                ORDER BY timestamp ASC`,
                [executionId]
            );
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get audit logs:`, error);
            throw error;
        }
    }

    async getAllAuditLogs(userId?: string, limit: number = 100): Promise<AuditLog[]> {
        try {
            let sql = `SELECT * FROM audit_logs`;
            const params: any[] = [];

            if (userId) {
                sql += ` WHERE user_id = $1`;
                params.push(userId);
            }

            sql += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            return await query<AuditLog>(sql, params);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get all audit logs:`, error);
            throw error;
        }
    }

    async getAuditLogsByType(
        userId: string,
        actionType: AuditLog['action_type'],
        limit: number = 50
    ): Promise<AuditLog[]> {
        try {
            return await query<AuditLog>(
                `SELECT * FROM audit_logs 
                WHERE user_id = $1 AND action_type = $2
                ORDER BY timestamp DESC 
                LIMIT $3`,
                [userId, actionType, limit]
            );
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get audit logs by type:`, error);
            throw error;
        }
    }

    async getErrorLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
        try {
            return await query<AuditLog>(
                `SELECT * FROM audit_logs 
                WHERE user_id = $1 AND success = false
                ORDER BY timestamp DESC 
                LIMIT $2`,
                [userId, limit]
            );
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get error logs:`, error);
            throw error;
        }
    }

    // ========================================
    // Observability Metrics
    // ========================================

    async addMetric(metric: ObservabilityMetrics): Promise<void> {
        try {
            await query(
                `INSERT INTO observability_metrics (
                    metric_id, timestamp, user_id, metric_type,
                    metric_value, aggregation_period, dimensions
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    metric.metric_id,
                    metric.timestamp,
                    metric.user_id,
                    metric.metric_type,
                    metric.metric_value,
                    metric.aggregation_period,
                    JSON.stringify(metric.dimensions || {}),
                ]
            );
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to add metric:`, error);
            throw error;
        }
    }

    async getMetrics(filters?: {
        userId?: string;
        metricType?: string;
        startTime?: string;
        endTime?: string;
        aggregationPeriod?: string;
        limit?: number;
    }): Promise<ObservabilityMetrics[]> {
        try {
            let sql = `SELECT * FROM observability_metrics WHERE 1=1`;
            const params: any[] = [];
            let paramIndex = 1;

            if (filters?.userId) {
                sql += ` AND user_id = $${paramIndex++}`;
                params.push(filters.userId);
            }
            if (filters?.metricType) {
                sql += ` AND metric_type = $${paramIndex++}`;
                params.push(filters.metricType);
            }
            if (filters?.startTime) {
                sql += ` AND timestamp >= $${paramIndex++}`;
                params.push(filters.startTime);
            }
            if (filters?.endTime) {
                sql += ` AND timestamp <= $${paramIndex++}`;
                params.push(filters.endTime);
            }
            if (filters?.aggregationPeriod) {
                sql += ` AND aggregation_period = $${paramIndex++}`;
                params.push(filters.aggregationPeriod);
            }

            sql += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
            params.push(filters?.limit || 100);

            return await query<ObservabilityMetrics>(sql, params);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get metrics:`, error);
            throw error;
        }
    }

    // ========================================
    // Billing Records
    // ========================================

    async addBillingRecord(record: BillingRecord): Promise<void> {
        try {
            await query(
                `INSERT INTO billing_records (
                    billing_id, user_id, execution_id, timestamp, model_id,
                    tokens_input, tokens_output, tokens_total, cost,
                    billing_period, paid, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    record.billing_id,
                    record.user_id,
                    record.execution_id,
                    record.timestamp,
                    record.model_id,
                    record.tokens_input,
                    record.tokens_output,
                    record.tokens_total,
                    record.cost,
                    record.billing_period,
                    record.paid,
                    JSON.stringify(record.metadata || {}),
                ]
            );
            console.log(`[WorkflowStore] ✅ Added billing record: ${record.billing_id} ($${record.cost.toFixed(4)})`);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to add billing record:`, error);
            throw error;
        }
    }

    async getBillingRecords(userId: string, billingPeriod?: string): Promise<BillingRecord[]> {
        try {
            let sql = `SELECT * FROM billing_records WHERE user_id = $1`;
            const params: any[] = [userId];

            if (billingPeriod) {
                sql += ` AND billing_period = $2`;
                params.push(billingPeriod);
            }

            sql += ` ORDER BY timestamp DESC`;

            return await query<BillingRecord>(sql, params);
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get billing records:`, error);
            throw error;
        }
    }

    async getBillingSummary(userId: string, billingPeriod: string): Promise<{
        totalCost: number;
        totalTokens: number;
        recordCount: number;
    }> {
        try {
            const results = await query<{
                total_cost: number;
                total_tokens: number;
                record_count: number;
            }>(
                `SELECT 
                    COALESCE(SUM(cost), 0) as total_cost,
                    COALESCE(SUM(tokens_total), 0) as total_tokens,
                    COUNT(*) as record_count
                FROM billing_records 
                WHERE user_id = $1 AND billing_period = $2`,
                [userId, billingPeriod]
            );

            return {
                totalCost: Number(results[0]?.total_cost) || 0,
                totalTokens: Number(results[0]?.total_tokens) || 0,
                recordCount: Number(results[0]?.record_count) || 0,
            };
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get billing summary:`, error);
            throw error;
        }
    }

    // ========================================
    // Statistics & Aggregations
    // ========================================

    async getStats(userId?: string): Promise<{
        totalExecutions: number;
        runningExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        totalCost: number;
        totalTokens: number;
        totalAuditLogs: number;
        averageExecutionTime: number;
    }> {
        try {
            // Get execution stats
            let execSql = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'running') as running,
                    COUNT(*) FILTER (WHERE status = 'success') as successful,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COALESCE(SUM(total_cost), 0) as cost,
                    COALESCE(SUM(total_tokens), 0) as tokens,
                    AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) 
                        FILTER (WHERE end_time IS NOT NULL) as avg_time
                FROM workflow_executions
            `;
            const execParams: any[] = [];

            if (userId) {
                execSql += ` WHERE user_id = $1`;
                execParams.push(userId);
            }

            const execResults = await query<any>(execSql, execParams);

            // Get audit log count
            let auditSql = `SELECT COUNT(*) as count FROM audit_logs`;
            const auditParams: any[] = [];

            if (userId) {
                auditSql += ` WHERE user_id = $1`;
                auditParams.push(userId);
            }

            const auditResults = await query<{ count: number }>(auditSql, auditParams);

            const exec = execResults[0] || {};
            return {
                totalExecutions: Number(exec.total) || 0,
                runningExecutions: Number(exec.running) || 0,
                successfulExecutions: Number(exec.successful) || 0,
                failedExecutions: Number(exec.failed) || 0,
                totalCost: Number(exec.cost) || 0,
                totalTokens: Number(exec.tokens) || 0,
                totalAuditLogs: Number(auditResults[0]?.count) || 0,
                averageExecutionTime: Number(exec.avg_time) || 0,
            };
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get stats:`, error);
            throw error;
        }
    }

    async getCostByMode(userId: string): Promise<Array<{
        mode: string;
        totalCost: number;
        totalTokens: number;
        executionCount: number;
    }>> {
        try {
            const results = await query<any>(
                `SELECT 
                    mode,
                    COALESCE(SUM(total_cost), 0) as total_cost,
                    COALESCE(SUM(total_tokens), 0) as total_tokens,
                    COUNT(*) as execution_count
                FROM workflow_executions
                WHERE user_id = $1
                GROUP BY mode
                ORDER BY total_cost DESC`,
                [userId]
            );

            return results.map(r => ({
                mode: r.mode,
                totalCost: Number(r.total_cost),
                totalTokens: Number(r.total_tokens),
                executionCount: Number(r.execution_count),
            }));
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to get cost by mode:`, error);
            throw error;
        }
    }

    // ========================================
    // Cleanup & Maintenance
    // ========================================

    async deleteOldRecords(daysToKeep: number = 90): Promise<{
        executionsDeleted: number;
        logsDeleted: number;
        metricsDeleted: number;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            const cutoffISO = cutoffDate.toISOString();

            // Delete old audit logs (cascade will handle related records)
            const logsResult = await query(
                `DELETE FROM audit_logs WHERE timestamp < $1 RETURNING log_id`,
                [cutoffISO]
            );

            // Delete old metrics
            const metricsResult = await query(
                `DELETE FROM observability_metrics WHERE timestamp < $1 RETURNING metric_id`,
                [cutoffISO]
            );

            // Delete old completed executions
            const execResult = await query(
                `DELETE FROM workflow_executions 
                WHERE status IN ('success', 'failed', 'cancelled') 
                AND start_time < $1 
                RETURNING execution_id`,
                [cutoffISO]
            );

            console.log(`[WorkflowStore] 🧹 Cleaned up old records (${daysToKeep} days retention)`);

            return {
                executionsDeleted: execResult.length,
                logsDeleted: logsResult.length,
                metricsDeleted: metricsResult.length,
            };
        } catch (error) {
            console.error(`[WorkflowStore] ❌ Failed to cleanup old records:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const workflowStore = new PostgresWorkflowStore();

// Also export class for testing
export { PostgresWorkflowStore };
