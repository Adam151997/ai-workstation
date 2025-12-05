// app/api/workflows/[id]/run/route.ts
// Execute a workflow template

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createAuditLog } from '@/lib/audit';

interface WorkflowStep {
    id: string;
    type: 'ai_prompt' | 'tool_call' | 'condition' | 'delay' | 'webhook';
    name: string;
    config: Record<string, any>;
    connections: string[];
    onError?: 'stop' | 'continue' | 'retry';
    retryCount?: number;
    timeout?: number;
}

// POST - Run workflow
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { inputs = {} } = body;

        // Get workflow template
        const templates = await query(
            `SELECT * FROM workflow_templates 
             WHERE template_id = $1 AND (user_id = $2 OR is_public = true)`,
            [id, userId]
        );

        if (templates.length === 0) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const template = templates[0];
        const steps: WorkflowStep[] = template.steps || [];

        if (steps.length === 0) {
            return NextResponse.json(
                { error: 'Workflow has no steps' },
                { status: 400 }
            );
        }

        // Create workflow run record
        const runResult = await query(
            `INSERT INTO workflow_runs (template_id, user_id, inputs, status, started_at)
             VALUES ($1, $2, $3, 'running', NOW())
             RETURNING run_id`,
            [id, userId, JSON.stringify(inputs)]
        );
        const runId = runResult[0].run_id;

        console.log(`[Workflow] Starting run ${runId} for template ${template.name}`);

        // Execute steps
        const stepResults: Record<string, any> = {};
        let currentStepId = steps[0].id;
        let errorOccurred = false;
        let errorMessage = '';
        let errorStepId = '';

        const startTime = Date.now();

        // Variable replacement function
        const replaceVariables = (text: string): string => {
            let result = text;
            
            // Replace input variables: {{variable_name}}
            for (const [key, value] of Object.entries(inputs)) {
                result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
            }
            
            // Replace step outputs: {{step_N_output}}
            for (const [stepId, output] of Object.entries(stepResults)) {
                const stepIndex = steps.findIndex(s => s.id === stepId);
                if (stepIndex !== -1) {
                    result = result.replace(
                        new RegExp(`{{step_${stepIndex + 1}_output}}`, 'g'),
                        typeof output === 'string' ? output : JSON.stringify(output)
                    );
                }
            }
            
            return result;
        };

        // Execute steps sequentially
        for (let i = 0; i < steps.length && !errorOccurred; i++) {
            const step = steps.find(s => s.id === currentStepId);
            if (!step) break;

            console.log(`[Workflow] Executing step ${i + 1}: ${step.name} (${step.type})`);

            try {
                let result: any = null;

                // Update run status
                await query(
                    `UPDATE workflow_runs SET current_step_id = $1 WHERE run_id = $2`,
                    [step.id, runId]
                );

                switch (step.type) {
                    case 'ai_prompt': {
                        const prompt = replaceVariables(step.config.prompt || '');
                        const model = step.config.model || 'llama-3.3-70b-versatile';
                        
                        const response = await generateText({
                            model: model.startsWith('gpt') ? openai(model) : groq(model),
                            prompt: prompt,
                            maxTokens: step.config.maxTokens || 2000,
                        });
                        
                        result = response.text;
                        break;
                    }

                    case 'tool_call': {
                        // For now, simulate tool calls
                        // TODO: Integrate with Composio MCP tools
                        const toolName = step.config.tool;
                        const toolParams = step.config.params || {};
                        
                        // Replace variables in params
                        const processedParams: Record<string, any> = {};
                        for (const [key, value] of Object.entries(toolParams)) {
                            processedParams[key] = typeof value === 'string' 
                                ? replaceVariables(value) 
                                : value;
                        }
                        
                        result = {
                            tool: toolName,
                            params: processedParams,
                            message: `Tool ${toolName} would be called with params: ${JSON.stringify(processedParams)}`,
                        };
                        break;
                    }

                    case 'condition': {
                        const condition = replaceVariables(step.config.condition || 'true');
                        // Simple condition evaluation
                        try {
                            result = eval(condition) ? 'true' : 'false';
                        } catch {
                            result = 'false';
                        }
                        break;
                    }

                    case 'delay': {
                        const delayMs = step.config.delay || 1000;
                        await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 10000)));
                        result = { delayed: delayMs };
                        break;
                    }

                    case 'webhook': {
                        // Placeholder for webhook calls
                        result = { webhook: step.config.url, status: 'simulated' };
                        break;
                    }

                    default:
                        result = { type: step.type, status: 'unknown' };
                }

                stepResults[step.id] = result;
                console.log(`[Workflow] Step ${step.name} completed`);

                // Move to next step
                if (step.connections && step.connections.length > 0) {
                    currentStepId = step.connections[0];
                } else {
                    break; // No more steps
                }

            } catch (stepError: any) {
                console.error(`[Workflow] Step ${step.name} failed:`, stepError);
                
                if (step.onError === 'continue') {
                    stepResults[step.id] = { error: stepError.message };
                    if (step.connections && step.connections.length > 0) {
                        currentStepId = step.connections[0];
                    } else {
                        break;
                    }
                } else {
                    errorOccurred = true;
                    errorMessage = stepError.message;
                    errorStepId = step.id;
                }
            }
        }

        const durationMs = Date.now() - startTime;
        const finalStatus = errorOccurred ? 'failed' : 'success';

        // Update run record with results
        await query(
            `UPDATE workflow_runs SET 
                status = $1,
                step_results = $2,
                outputs = $3,
                completed_at = NOW(),
                duration_ms = $4,
                error_step_id = $5,
                error_message = $6
            WHERE run_id = $7`,
            [
                finalStatus,
                JSON.stringify(stepResults),
                JSON.stringify(stepResults[steps[steps.length - 1]?.id] || {}),
                durationMs,
                errorStepId || null,
                errorMessage || null,
                runId,
            ]
        );

        console.log(`[Workflow] Run ${runId} completed in ${durationMs}ms`);

        // Log to audit trail
        await createAuditLog({
            userId,
            action: 'workflow.run',
            resource: 'workflow',
            resourceId: id,
            metadata: {
                workflowName: template.name,
                runId,
                status: finalStatus,
                stepsCompleted: Object.keys(stepResults).length,
                totalSteps: steps.length,
                durationMs,
                inputs: Object.keys(inputs),
                error: errorOccurred ? errorMessage : null,
            },
            request: req,
        });

        return NextResponse.json({
            success: !errorOccurred,
            runId,
            status: finalStatus,
            durationMs,
            stepResults,
            outputs: stepResults[steps[steps.length - 1]?.id] || {},
            error: errorOccurred ? { stepId: errorStepId, message: errorMessage } : null,
        });

    } catch (error: any) {
        console.error('[Workflows] Run error:', error);
        return NextResponse.json(
            { error: 'Failed to run workflow', details: error.message },
            { status: 500 }
        );
    }
}
