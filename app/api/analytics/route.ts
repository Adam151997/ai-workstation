// app/api/analytics/route.ts
// Time-series analytics API for charts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'usage';
        const days = parseInt(searchParams.get('days') || '14');

        switch (type) {
            case 'usage':
                return await getUsageTimeSeries(userId, days);
            case 'cost':
                return await getCostTimeSeries(userId, days);
            case 'workflows':
                return await getWorkflowTimeSeries(userId, days);
            case 'summary':
                return await getAnalyticsSummary(userId, days);
            default:
                return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[Analytics] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics', details: error.message },
            { status: 500 }
        );
    }
}

async function getUsageTimeSeries(userId: string, days: number) {
    // Try to get from usage_aggregates first
    const aggregates = await query(`
        SELECT 
            date,
            total_requests,
            total_tokens_input + total_tokens_output as total_tokens,
            total_cost,
            chat_requests,
            chat_tokens_input + chat_tokens_output as chat_tokens,
            embedding_requests,
            embedding_tokens
        FROM usage_aggregates
        WHERE user_id = $1
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date ASC
    `, [userId]);

    // If no aggregates, try to compute from usage_records
    if (aggregates.length === 0) {
        const records = await query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_requests,
                COALESCE(SUM(tokens_input + tokens_output), 0) as total_tokens,
                COALESCE(SUM(cost), 0) as total_cost,
                COUNT(*) FILTER (WHERE usage_type = 'chat') as chat_requests,
                COALESCE(SUM(tokens_input + tokens_output) FILTER (WHERE usage_type = 'chat'), 0) as chat_tokens,
                COUNT(*) FILTER (WHERE usage_type = 'embedding') as embedding_requests,
                COALESCE(SUM(tokens_input + tokens_output) FILTER (WHERE usage_type = 'embedding'), 0) as embedding_tokens
            FROM usage_records
            WHERE user_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [userId]);

        return formatTimeSeriesResponse(records, days);
    }

    return formatTimeSeriesResponse(aggregates, days);
}

async function getCostTimeSeries(userId: string, days: number) {
    // Get daily cost data
    const costData = await query(`
        SELECT 
            DATE(created_at) as date,
            COALESCE(SUM(cost), 0) as total_cost,
            COALESCE(SUM(cost) FILTER (WHERE usage_type = 'chat'), 0) as chat_cost,
            COALESCE(SUM(cost) FILTER (WHERE usage_type = 'embedding'), 0) as embedding_cost,
            COALESCE(SUM(cost) FILTER (WHERE usage_type = 'tool_call'), 0) as tool_cost
        FROM usage_records
        WHERE user_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `, [userId]);

    // Also get workflow execution costs
    const workflowCosts = await query(`
        SELECT 
            DATE(start_time) as date,
            COALESCE(SUM(total_cost), 0) as workflow_cost
        FROM workflow_executions
        WHERE user_id = $1
        AND start_time >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(start_time)
        ORDER BY date ASC
    `, [userId]);

    // Merge the data
    const mergedData = mergeCostData(costData, workflowCosts, days);

    return NextResponse.json({
        success: true,
        data: mergedData,
        period: `${days} days`,
    });
}

async function getWorkflowTimeSeries(userId: string, days: number) {
    const workflows = await query(`
        SELECT 
            DATE(start_time) as date,
            COUNT(*) as total_runs,
            COUNT(*) FILTER (WHERE status = 'success') as successful,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COALESCE(AVG(total_tokens), 0) as avg_tokens,
            COALESCE(AVG(total_cost), 0) as avg_cost,
            COALESCE(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000), 0) as avg_duration_ms
        FROM workflow_executions
        WHERE user_id = $1
        AND start_time >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(start_time)
        ORDER BY date ASC
    `, [userId]);

    // Also get workflow template runs
    const templateRuns = await query(`
        SELECT 
            DATE(started_at) as date,
            COUNT(*) as total_runs,
            COUNT(*) FILTER (WHERE status = 'success') as successful,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COALESCE(AVG(duration_ms), 0) as avg_duration_ms
        FROM workflow_runs
        WHERE user_id = $1
        AND started_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(started_at)
        ORDER BY date ASC
    `, [userId]);

    // Format with success rate
    const data = fillMissingDates(workflows, days).map(row => ({
        date: row.date,
        displayDate: formatDisplayDate(row.date),
        totalRuns: parseInt(row.total_runs) || 0,
        successful: parseInt(row.successful) || 0,
        failed: parseInt(row.failed) || 0,
        successRate: row.total_runs > 0 
            ? (row.successful / row.total_runs * 100) 
            : 100,
        avgTokens: parseFloat(row.avg_tokens) || 0,
        avgCost: parseFloat(row.avg_cost) || 0,
        avgDurationMs: parseFloat(row.avg_duration_ms) || 0,
    }));

    // Merge template runs
    const templateData = fillMissingDates(templateRuns, days);
    data.forEach((row, i) => {
        const template = templateData[i];
        if (template) {
            row.totalRuns += parseInt(template.total_runs) || 0;
            row.successful += parseInt(template.successful) || 0;
            row.failed += parseInt(template.failed) || 0;
            row.successRate = row.totalRuns > 0 
                ? (row.successful / row.totalRuns * 100) 
                : 100;
        }
    });

    return NextResponse.json({
        success: true,
        data,
        period: `${days} days`,
    });
}

async function getAnalyticsSummary(userId: string, days: number) {
    // Get overall summary stats
    const [usage, workflows, trends] = await Promise.all([
        // Total usage
        query(`
            SELECT 
                COUNT(*) as total_requests,
                COALESCE(SUM(tokens_input + tokens_output), 0) as total_tokens,
                COALESCE(SUM(cost), 0) as total_cost
            FROM usage_records
            WHERE user_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        `, [userId]),

        // Workflow stats
        query(`
            SELECT 
                COUNT(*) as total_workflows,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM workflow_executions
            WHERE user_id = $1
            AND start_time >= CURRENT_DATE - INTERVAL '${days} days'
        `, [userId]),

        // Trend comparison (current period vs previous)
        query(`
            WITH current_period AS (
                SELECT COALESCE(SUM(cost), 0) as cost, COUNT(*) as requests
                FROM usage_records
                WHERE user_id = $1
                AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
            ),
            previous_period AS (
                SELECT COALESCE(SUM(cost), 0) as cost, COUNT(*) as requests
                FROM usage_records
                WHERE user_id = $1
                AND created_at >= CURRENT_DATE - INTERVAL '${days * 2} days'
                AND created_at < CURRENT_DATE - INTERVAL '${days} days'
            )
            SELECT 
                c.cost as current_cost,
                c.requests as current_requests,
                p.cost as previous_cost,
                p.requests as previous_requests
            FROM current_period c, previous_period p
        `, [userId]),
    ]);

    const usageRow = usage[0] || {};
    const workflowRow = workflows[0] || {};
    const trendRow = trends[0] || {};

    // Calculate trend percentages
    const costTrend = trendRow.previous_cost > 0 
        ? ((trendRow.current_cost - trendRow.previous_cost) / trendRow.previous_cost * 100)
        : 0;
    const requestsTrend = trendRow.previous_requests > 0
        ? ((trendRow.current_requests - trendRow.previous_requests) / trendRow.previous_requests * 100)
        : 0;

    return NextResponse.json({
        success: true,
        summary: {
            usage: {
                totalRequests: parseInt(usageRow.total_requests) || 0,
                totalTokens: parseInt(usageRow.total_tokens) || 0,
                totalCost: parseFloat(usageRow.total_cost) || 0,
            },
            workflows: {
                total: parseInt(workflowRow.total_workflows) || 0,
                successful: parseInt(workflowRow.successful) || 0,
                failed: parseInt(workflowRow.failed) || 0,
                successRate: workflowRow.total_workflows > 0
                    ? (workflowRow.successful / workflowRow.total_workflows * 100)
                    : 100,
            },
            trends: {
                costChange: costTrend,
                requestsChange: requestsTrend,
                costDirection: costTrend >= 0 ? 'up' : 'down',
                requestsDirection: requestsTrend >= 0 ? 'up' : 'down',
            },
        },
        period: `${days} days`,
    });
}

// Helper functions
function formatTimeSeriesResponse(data: any[], days: number) {
    const filledData = fillMissingDates(data, days);
    
    return NextResponse.json({
        success: true,
        data: filledData.map(row => ({
            date: row.date,
            displayDate: formatDisplayDate(row.date),
            requests: parseInt(row.total_requests) || 0,
            tokens: parseInt(row.total_tokens) || 0,
            cost: parseFloat(row.total_cost) || 0,
            chatRequests: parseInt(row.chat_requests) || 0,
            chatTokens: parseInt(row.chat_tokens) || 0,
            embeddingRequests: parseInt(row.embedding_requests) || 0,
            embeddingTokens: parseInt(row.embedding_tokens) || 0,
        })),
        period: `${days} days`,
    });
}

function fillMissingDates(data: any[], days: number): any[] {
    const result: any[] = [];
    const dataMap = new Map(data.map(row => [
        new Date(row.date).toISOString().split('T')[0],
        row
    ]));

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        result.push(dataMap.get(dateStr) || {
            date: dateStr,
            total_requests: 0,
            total_tokens: 0,
            total_cost: 0,
            chat_requests: 0,
            chat_tokens: 0,
            embedding_requests: 0,
            embedding_tokens: 0,
            total_runs: 0,
            successful: 0,
            failed: 0,
            avg_tokens: 0,
            avg_cost: 0,
            avg_duration_ms: 0,
        });
    }

    return result;
}

function mergeCostData(costData: any[], workflowCosts: any[], days: number): any[] {
    const costMap = new Map(costData.map(row => [
        new Date(row.date).toISOString().split('T')[0],
        row
    ]));
    const workflowMap = new Map(workflowCosts.map(row => [
        new Date(row.date).toISOString().split('T')[0],
        row
    ]));

    const result: any[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const cost = costMap.get(dateStr) || {};
        const workflow = workflowMap.get(dateStr) || {};

        result.push({
            date: dateStr,
            displayDate: formatDisplayDate(dateStr),
            totalCost: (parseFloat(cost.total_cost) || 0) + (parseFloat(workflow.workflow_cost) || 0),
            chatCost: parseFloat(cost.chat_cost) || 0,
            embeddingCost: parseFloat(cost.embedding_cost) || 0,
            toolCost: parseFloat(cost.tool_cost) || 0,
            workflowCost: parseFloat(workflow.workflow_cost) || 0,
        });
    }

    return result;
}

function formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
