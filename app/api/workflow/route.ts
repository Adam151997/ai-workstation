// app/api/workflow/route.ts
// Workflow API endpoints - Updated for PostgreSQL persistence (Phase 0)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { workflowStore } from '@/lib/db/workflow-store';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'executions' | 'execution' | 'audit' | 'metrics' | 'stats' | 'billing'
        const executionId = searchParams.get('executionId');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        switch (type) {
            case 'executions': {
                const executions = await workflowStore.getAllExecutions(userId, limit);
                return NextResponse.json({ 
                    success: true,
                    executions,
                    count: executions.length,
                });
            }

            case 'execution': {
                if (!executionId) {
                    return NextResponse.json({ error: 'executionId required' }, { status: 400 });
                }
                const execution = await workflowStore.getExecution(executionId);
                
                // Security: Verify user owns this execution
                if (execution && execution.user_id !== userId) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                
                const steps = await workflowStore.getSteps(executionId);
                return NextResponse.json({ 
                    success: true,
                    execution, 
                    steps,
                });
            }

            case 'audit': {
                if (executionId) {
                    // First verify user owns this execution
                    const execution = await workflowStore.getExecution(executionId);
                    if (execution && execution.user_id !== userId) {
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                    }
                    
                    const logs = await workflowStore.getAuditLogs(executionId);
                    return NextResponse.json({ 
                        success: true,
                        logs,
                        count: logs.length,
                    });
                } else {
                    const allLogs = await workflowStore.getAllAuditLogs(userId, limit);
                    return NextResponse.json({ 
                        success: true,
                        logs: allLogs,
                        count: allLogs.length,
                    });
                }
            }

            case 'errors': {
                const errorLogs = await workflowStore.getErrorLogs(userId, limit);
                return NextResponse.json({ 
                    success: true,
                    logs: errorLogs,
                    count: errorLogs.length,
                });
            }

            case 'metrics': {
                const startTime = searchParams.get('startTime');
                const endTime = searchParams.get('endTime');
                const metricType = searchParams.get('metricType');
                const aggregationPeriod = searchParams.get('aggregationPeriod');
                
                const metrics = await workflowStore.getMetrics({
                    userId,
                    startTime: startTime || undefined,
                    endTime: endTime || undefined,
                    metricType: metricType || undefined,
                    aggregationPeriod: aggregationPeriod || undefined,
                    limit,
                });
                return NextResponse.json({ 
                    success: true,
                    metrics,
                    count: metrics.length,
                });
            }

            case 'stats': {
                const stats = await workflowStore.getStats(userId);
                return NextResponse.json({ 
                    success: true,
                    stats,
                });
            }

            case 'cost-by-mode': {
                const costByMode = await workflowStore.getCostByMode(userId);
                return NextResponse.json({ 
                    success: true,
                    costByMode,
                });
            }

            case 'billing': {
                const billingPeriod = searchParams.get('period');
                const records = await workflowStore.getBillingRecords(
                    userId,
                    billingPeriod || undefined
                );
                
                // Also get summary if period is specified
                let summary = null;
                if (billingPeriod) {
                    summary = await workflowStore.getBillingSummary(userId, billingPeriod);
                }
                
                return NextResponse.json({ 
                    success: true,
                    records,
                    summary,
                    count: records.length,
                });
            }

            case 'running': {
                const running = await workflowStore.getRunningExecutions(userId);
                return NextResponse.json({ 
                    success: true,
                    executions: running,
                    count: running.length,
                });
            }

            default:
                return NextResponse.json({ 
                    error: 'Invalid type parameter',
                    validTypes: ['executions', 'execution', 'audit', 'errors', 'metrics', 'stats', 'cost-by-mode', 'billing', 'running'],
                }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[Workflow API] Error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: 'Internal server error',
                message: error.message,
            },
            { status: 500 }
        );
    }
}

/**
 * POST endpoint for administrative actions
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'cleanup': {
                // Clean up old records (admin action)
                const daysToKeep = body.daysToKeep || 90;
                const result = await workflowStore.deleteOldRecords(daysToKeep);
                return NextResponse.json({ 
                    success: true,
                    message: `Cleaned up records older than ${daysToKeep} days`,
                    ...result,
                });
            }

            default:
                return NextResponse.json({ 
                    error: 'Invalid action',
                    validActions: ['cleanup'],
                }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[Workflow API] POST Error:', error);
        return NextResponse.json(
            { 
                success: false,
                error: 'Internal server error',
                message: error.message,
            },
            { status: 500 }
        );
    }
}
