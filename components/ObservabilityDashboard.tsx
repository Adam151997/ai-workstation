// components/ObservabilityDashboard.tsx
'use client';

import { useMemo } from 'react';
import { ObservabilityMetrics, WorkflowExecution } from '@/lib/db/schema';
import {
    DollarSign,
    Zap,
    Clock,
    TrendingUp,
    TrendingDown,
    Activity,
    CheckCircle,
    XCircle,
} from 'lucide-react';

interface ObservabilityDashboardProps {
    executions: WorkflowExecution[];
    metrics: ObservabilityMetrics[];
}

export function ObservabilityDashboard({
    executions,
    metrics,
}: ObservabilityDashboardProps) {
    const stats = useMemo(() => {
        const totalExecutions = executions.length;
        const runningExecutions = executions.filter(e => e.status === 'running').length;
        const successfulExecutions = executions.filter(e => e.status === 'success').length;
        const failedExecutions = executions.filter(e => e.status === 'failed').length;
        
        const successRate = totalExecutions > 0 
            ? (successfulExecutions / totalExecutions) * 100 
            : 0;

        const totalCost = executions.reduce((sum, e) => sum + e.total_cost, 0);
        const totalTokens = executions.reduce((sum, e) => sum + e.total_tokens, 0);

        const completedExecutions = executions.filter(e => e.end_time);
        const avgExecutionTime = completedExecutions.length > 0
            ? completedExecutions.reduce((sum, e) => {
                const duration = new Date(e.end_time!).getTime() - new Date(e.start_time).getTime();
                return sum + duration;
            }, 0) / completedExecutions.length
            : 0;

        // Cost per execution
        const avgCostPerExecution = totalExecutions > 0 
            ? totalCost / totalExecutions 
            : 0;

        // Tokens per execution
        const avgTokensPerExecution = totalExecutions > 0 
            ? totalTokens / totalExecutions 
            : 0;

        return {
            totalExecutions,
            runningExecutions,
            successfulExecutions,
            failedExecutions,
            successRate,
            totalCost,
            totalTokens,
            avgExecutionTime,
            avgCostPerExecution,
            avgTokensPerExecution,
        };
    }, [executions]);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toFixed(0);
    };

    return (
        <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
                {/* Total Cost */}
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Total Cost</span>
                        <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        ${stats.totalCost.toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Avg: ${stats.avgCostPerExecution.toFixed(4)}/exec
                    </div>
                </div>

                {/* Total Tokens */}
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Total Tokens</span>
                        <Zap className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatNumber(stats.totalTokens)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Avg: {formatNumber(stats.avgTokensPerExecution)}/exec
                    </div>
                </div>

                {/* Success Rate */}
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Success Rate</span>
                        <Activity className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {stats.successRate.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {stats.successfulExecutions}
                        </span>
                        <span className="text-xs text-red-600 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            {stats.failedExecutions}
                        </span>
                    </div>
                </div>

                {/* Avg Execution Time */}
                <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Avg Time</span>
                        <Clock className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatDuration(stats.avgExecutionTime)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {stats.runningExecutions} running
                    </div>
                </div>
            </div>

            {/* Recent Executions */}
            <div className="bg-white border rounded-lg shadow-sm">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Recent Executions
                    </h3>
                </div>
                <div className="divide-y max-h-64 overflow-y-auto">
                    {executions.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No executions yet
                        </div>
                    ) : (
                        executions.slice(0, 10).map(execution => {
                            const duration = execution.end_time
                                ? new Date(execution.end_time).getTime() - new Date(execution.start_time).getTime()
                                : Date.now() - new Date(execution.start_time).getTime();

                            return (
                                <div key={execution.execution_id} className="p-3 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div
                                                className={`w-2 h-2 rounded-full ${
                                                    execution.status === 'success'
                                                        ? 'bg-green-600'
                                                        : execution.status === 'failed'
                                                            ? 'bg-red-600'
                                                            : execution.status === 'running'
                                                                ? 'bg-blue-600 animate-pulse'
                                                                : 'bg-gray-400'
                                                }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 truncate">
                                                        {execution.workflow_name}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {execution.mode}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                                    <span>{formatDuration(duration)}</span>
                                                    <span>{execution.total_tokens.toLocaleString()} tokens</span>
                                                    <span>${execution.total_cost.toFixed(4)}</span>
                                                    <span>{execution.steps_completed}/{execution.steps_total} steps</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Cost Breakdown by Mode */}
            <div className="bg-white border rounded-lg shadow-sm">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Cost Breakdown by Mode
                    </h3>
                </div>
                <div className="p-4">
                    {['Sales', 'Marketing', 'Admin'].map(mode => {
                        const modeExecutions = executions.filter(e => e.mode === mode);
                        const modeCost = modeExecutions.reduce((sum, e) => sum + e.total_cost, 0);
                        const modeTokens = modeExecutions.reduce((sum, e) => sum + e.total_tokens, 0);
                        const percentage = stats.totalCost > 0 ? (modeCost / stats.totalCost) * 100 : 0;

                        return (
                            <div key={mode} className="mb-4 last:mb-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">
                                        {mode}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        ${modeCost.toFixed(4)} ({percentage.toFixed(1)}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${
                                            mode === 'Sales'
                                                ? 'bg-blue-600'
                                                : mode === 'Marketing'
                                                    ? 'bg-green-600'
                                                    : 'bg-purple-600'
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {modeExecutions.length} executions • {formatNumber(modeTokens)} tokens
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
