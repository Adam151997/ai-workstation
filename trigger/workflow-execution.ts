// trigger/workflow-execution.ts
// Background job for long-running workflow executions
// Bypasses Vercel's 60-second timeout

import { task, wait } from "@trigger.dev/sdk/v3";
import { WorkflowJobPayload } from "./client";

/**
 * Workflow Execution Job
 * 
 * Runs multi-step workflows in the background with:
 * - No timeout limits
 * - Progress tracking
 * - Automatic retries
 * - Audit logging
 */
export const workflowExecutionJob = task({
    id: "workflow-execution",
    // Retry configuration
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 10000,
        factor: 2,
    },
    // Machine configuration
    machine: {
        preset: "small-1x", // Can scale up for heavy workloads
    },
    run: async (payload: WorkflowJobPayload, { ctx }) => {
        const { executionId, workflowName, steps, metadata } = payload;
        
        console.log(`[Workflow Job] 🚀 Starting: ${workflowName} (${executionId})`);
        console.log(`[Workflow Job] User: ${metadata.userId}, Mode: ${metadata.mode}`);
        console.log(`[Workflow Job] Steps: ${steps.length}`);

        const results: Array<{
            stepNumber: number;
            stepName: string;
            status: 'success' | 'failed' | 'skipped';
            result?: any;
            error?: string;
            duration: number;
        }> = [];

        let totalTokens = 0;
        let totalCost = 0;

        // Execute each step
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepNumber = i + 1;
            const stepStartTime = Date.now();

            console.log(`[Workflow Job] ▶️ Step ${stepNumber}/${steps.length}: ${step.name}`);

            try {
                // Update database with step status
                await updateStepStatus(executionId, stepNumber, 'running');

                // Execute the step
                const stepResult = await executeStep(step, metadata);

                const duration = Date.now() - stepStartTime;
                totalTokens += stepResult.tokensUsed || 0;
                totalCost += stepResult.cost || 0;

                results.push({
                    stepNumber,
                    stepName: step.name,
                    status: 'success',
                    result: stepResult.data,
                    duration,
                });

                // Update database with success
                await updateStepStatus(executionId, stepNumber, 'success', {
                    result: stepResult.data,
                    tokensUsed: stepResult.tokensUsed,
                    cost: stepResult.cost,
                    duration,
                });

                console.log(`[Workflow Job] ✅ Step ${stepNumber} completed (${duration}ms)`);

                // Small delay between steps to avoid rate limiting
                if (i < steps.length - 1) {
                    await wait.for({ seconds: 1 });
                }

            } catch (error: any) {
                const duration = Date.now() - stepStartTime;
                
                results.push({
                    stepNumber,
                    stepName: step.name,
                    status: 'failed',
                    error: error.message,
                    duration,
                });

                // Update database with failure
                await updateStepStatus(executionId, stepNumber, 'failed', {
                    error: error.message,
                    duration,
                });

                console.error(`[Workflow Job] ❌ Step ${stepNumber} failed: ${error.message}`);

                // Decide whether to continue or abort
                // For now, we continue with remaining steps
            }
        }

        // Calculate final status
        const failedSteps = results.filter(r => r.status === 'failed').length;
        const finalStatus = failedSteps === 0 
            ? 'success' 
            : failedSteps === steps.length 
                ? 'failed' 
                : 'partial';

        // Update execution with final status
        await updateExecutionStatus(executionId, finalStatus, {
            totalTokens,
            totalCost,
            stepsCompleted: results.filter(r => r.status === 'success').length,
            stepsFailed: failedSteps,
        });

        console.log(`[Workflow Job] 🏁 Workflow ${finalStatus}: ${workflowName}`);
        console.log(`[Workflow Job] Tokens: ${totalTokens}, Cost: $${totalCost.toFixed(4)}`);

        return {
            executionId,
            status: finalStatus,
            results,
            summary: {
                totalSteps: steps.length,
                completedSteps: results.filter(r => r.status === 'success').length,
                failedSteps,
                totalTokens,
                totalCost,
            },
        };
    },
});

/**
 * Execute a single workflow step
 */
async function executeStep(
    step: { name: string; description: string; tool?: string; parameters?: Record<string, any> },
    metadata: { userId: string; mode: string; modelId: string }
): Promise<{ data: any; tokensUsed: number; cost: number }> {
    // If step has a tool, execute it via MCP
    if (step.tool) {
        return await executeToolStep(step.tool, step.parameters || {}, metadata);
    }

    // Otherwise, it's an AI reasoning step
    return await executeAIStep(step.description, metadata);
}

/**
 * Execute a tool-based step via Composio MCP
 */
async function executeToolStep(
    toolName: string,
    parameters: Record<string, any>,
    metadata: { userId: string; mode: string; modelId: string }
): Promise<{ data: any; tokensUsed: number; cost: number }> {
    // Import dynamically to avoid issues in Trigger.dev environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true', // Mark as internal call
        },
        body: JSON.stringify({
            toolName,
            parameters,
            userId: metadata.userId,
            mode: metadata.mode,
        }),
    });

    if (!response.ok) {
        throw new Error(`Tool execution failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
        data: result.data,
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
    };
}

/**
 * Execute an AI reasoning step
 */
async function executeAIStep(
    prompt: string,
    metadata: { userId: string; mode: string; modelId: string }
): Promise<{ data: any; tokensUsed: number; cost: number }> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/ai/reason`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true',
        },
        body: JSON.stringify({
            prompt,
            userId: metadata.userId,
            mode: metadata.mode,
            modelId: metadata.modelId,
        }),
    });

    if (!response.ok) {
        throw new Error(`AI reasoning failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    return {
        data: result.response,
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
    };
}

/**
 * Update step status in database
 */
async function updateStepStatus(
    executionId: string,
    stepNumber: number,
    status: string,
    data?: Record<string, any>
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    await fetch(`${baseUrl}/api/workflow/update-step`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true',
        },
        body: JSON.stringify({
            executionId,
            stepNumber,
            status,
            ...data,
        }),
    });
}

/**
 * Update execution status in database
 */
async function updateExecutionStatus(
    executionId: string,
    status: string,
    data: Record<string, any>
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    await fetch(`${baseUrl}/api/workflow/update-execution`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'true',
        },
        body: JSON.stringify({
            executionId,
            status,
            ...data,
        }),
    });
}
