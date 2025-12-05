// components/WorkflowProgress.tsx
'use client';

import { useEffect, useState } from 'react';
import { WorkflowExecution, WorkflowStep } from '@/lib/db/schema';
import { CheckCircle2, Circle, XCircle, Clock, DollarSign, Zap, Loader2 } from 'lucide-react';

interface WorkflowProgressProps {
    execution: WorkflowExecution;
    steps: WorkflowStep[];
    onCancel?: () => void;
    onRetry?: (stepId: string) => void;
}

export function WorkflowProgress({
    execution,
    steps,
    onCancel,
    onRetry,
}: WorkflowProgressProps) {
    const [elapsedTime, setElapsedTime] = useState(0);

    // Update elapsed time every second for running workflows
    useEffect(() => {
        if (execution.status === 'running') {
            const interval = setInterval(() => {
                const elapsed = Date.now() - new Date(execution.start_time).getTime();
                setElapsedTime(elapsed);
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [execution.status, execution.start_time]);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const progressPercentage = execution.steps_total > 0
        ? Math.round((execution.steps_completed / execution.steps_total) * 100)
        : 0;

    const getStepIcon = (step: WorkflowStep) => {
        switch (step.status) {
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-600" />;
            case 'running':
                return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
            case 'pending':
                return <Circle className="w-5 h-5 text-gray-400" />;
            case 'skipped':
                return <Circle className="w-5 h-5 text-yellow-600" />;
        }
    };

    const getStatusColor = (status: WorkflowExecution['status']) => {
        switch (status) {
            case 'running':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'success':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'failed':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'partial':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            {execution.workflow_name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {execution.metadata.description}
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(execution.status)}`}>
                        {execution.status.toUpperCase()}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                            {execution.status === 'running' 
                                ? formatDuration(elapsedTime)
                                : execution.end_time 
                                    ? formatDuration(new Date(execution.end_time).getTime() - new Date(execution.start_time).getTime())
                                    : '0s'
                            }
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                            {execution.total_tokens.toLocaleString()} tokens
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                            ${execution.total_cost.toFixed(4)}
                        </span>
                    </div>
                    <div className="text-gray-600">
                        {execution.steps_completed}/{execution.steps_total} steps
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{progressPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                                execution.status === 'success' 
                                    ? 'bg-green-600'
                                    : execution.status === 'failed'
                                        ? 'bg-red-600'
                                        : 'bg-blue-600'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Steps List */}
            <div className="divide-y">
                {steps.map((step) => (
                    <div
                        key={step.step_id}
                        className={`p-4 ${
                            step.status === 'running' ? 'bg-blue-50' : ''
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                {getStepIcon(step)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium text-gray-900">
                                        Step {step.step_number}: {step.step_name}
                                    </h4>
                                    {step.duration_ms && (
                                        <span className="text-xs text-gray-500">
                                            {formatDuration(step.duration_ms)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                    {step.step_description}
                                </p>
                                {step.tool_name && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        <span className="font-medium">Tool:</span> {step.tool_name}
                                    </div>
                                )}
                                {step.status === 'failed' && step.error_message && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                                        <span className="font-medium">Error:</span> {step.error_message}
                                    </div>
                                )}
                                {step.status === 'success' && step.cost > 0 && (
                                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                        <span>{step.tokens_used.toLocaleString()} tokens</span>
                                        <span>${step.cost.toFixed(4)}</span>
                                    </div>
                                )}
                                {step.status === 'failed' && onRetry && step.retry_count < 3 && (
                                    <button
                                        onClick={() => onRetry(step.step_id)}
                                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        Retry ({step.retry_count + 1}/3)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Actions */}
            {execution.status === 'running' && onCancel && (
                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-300 transition-colors"
                    >
                        Cancel Workflow
                    </button>
                </div>
            )}
        </div>
    );
}
