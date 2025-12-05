// app/api/jobs/status/route.ts
// Get status of a background job
// Phase 1: Async Job Queue

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runs } from "@trigger.dev/sdk/v3";

/**
 * GET /api/jobs/status?runId=xxx
 * Get the status of a Trigger.dev run
 */
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const runId = searchParams.get("runId");
        const executionId = searchParams.get("executionId");

        if (!runId && !executionId) {
            return NextResponse.json(
                { error: "runId or executionId required" },
                { status: 400 }
            );
        }

        // If we have a runId, get status from Trigger.dev
        if (runId) {
            try {
                const run = await runs.retrieve(runId);
                
                return NextResponse.json({
                    success: true,
                    source: "trigger.dev",
                    runId: run.id,
                    taskIdentifier: run.taskIdentifier,
                    status: run.status,
                    createdAt: run.createdAt,
                    startedAt: run.startedAt,
                    finishedAt: run.finishedAt,
                    output: run.output,
                    error: run.error,
                    isCompleted: ["COMPLETED", "FAILED", "CANCELED", "CRASHED", "SYSTEM_FAILURE"].includes(run.status),
                    isSuccess: run.status === "COMPLETED",
                });
            } catch (triggerError: any) {
                // Trigger.dev might not be configured, fall back to database
                console.warn("[Jobs Status] Trigger.dev error:", triggerError.message);
            }
        }

        // Fall back to database status
        if (executionId) {
            const { workflowStore } = await import("@/lib/db/workflow-store");
            const execution = await workflowStore.getExecution(executionId);

            if (!execution) {
                return NextResponse.json(
                    { error: "Execution not found" },
                    { status: 404 }
                );
            }

            // Verify user owns this execution
            if (execution.user_id !== userId) {
                return NextResponse.json(
                    { error: "Forbidden" },
                    { status: 403 }
                );
            }

            const steps = await workflowStore.getSteps(executionId);

            return NextResponse.json({
                success: true,
                source: "database",
                executionId: execution.execution_id,
                workflowName: execution.workflow_name,
                status: execution.status,
                mode: execution.mode,
                modelId: execution.model_id,
                stepsTotal: execution.steps_total,
                stepsCompleted: execution.steps_completed,
                stepsFailed: execution.steps_failed,
                totalCost: execution.total_cost,
                totalTokens: execution.total_tokens,
                startTime: execution.start_time,
                endTime: execution.end_time,
                errorMessage: execution.error_message,
                steps: steps.map(s => ({
                    stepId: s.step_id,
                    stepNumber: s.step_number,
                    stepName: s.step_name,
                    status: s.status,
                    toolName: s.tool_name,
                    duration: s.duration_ms,
                    tokensUsed: s.tokens_used,
                    cost: s.cost,
                    error: s.error_message,
                })),
                isCompleted: ["success", "failed", "partial", "cancelled"].includes(execution.status),
                isSuccess: execution.status === "success",
            });
        }

        return NextResponse.json(
            { error: "Could not retrieve job status" },
            { status: 500 }
        );

    } catch (error: any) {
        console.error("[Jobs Status] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
