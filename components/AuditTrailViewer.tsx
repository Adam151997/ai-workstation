// components/AuditTrailViewer.tsx
'use client';

import { useState } from 'react';
import { AuditLog } from '@/lib/db/schema';
import {
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    Wrench,
    Brain,
    AlertCircle,
    RotateCcw,
    User,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

interface AuditTrailViewerProps {
    logs: AuditLog[];
    compact?: boolean;
}

export function AuditTrailViewer({ logs, compact = false }: AuditTrailViewerProps) {
    const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'errors' | 'tools' | 'ai'>('all');

    const toggleExpanded = (logId: string) => {
        const newExpanded = new Set(expandedLogs);
        if (newExpanded.has(logId)) {
            newExpanded.delete(logId);
        } else {
            newExpanded.add(logId);
        }
        setExpandedLogs(newExpanded);
    };

    const getActionIcon = (actionType: AuditLog['action_type']) => {
        switch (actionType) {
            case 'workflow_start':
            case 'workflow_end':
                return <FileText className="w-4 h-4" />;
            case 'step_start':
            case 'step_end':
                return <Clock className="w-4 h-4" />;
            case 'tool_call':
                return <Wrench className="w-4 h-4" />;
            case 'ai_decision':
                return <Brain className="w-4 h-4" />;
            case 'error':
                return <AlertCircle className="w-4 h-4" />;
            case 'retry':
                return <RotateCcw className="w-4 h-4" />;
            case 'user_intervention':
                return <User className="w-4 h-4" />;
        }
    };

    const getStatusIcon = (success: boolean) => {
        return success ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
        ) : (
            <XCircle className="w-4 h-4 text-red-600" />
        );
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        });
    };

    const filteredLogs = logs.filter(log => {
        if (filter === 'all') return true;
        if (filter === 'errors') return !log.success;
        if (filter === 'tools') return log.action_type === 'tool_call';
        if (filter === 'ai') return log.action_type === 'ai_decision';
        return true;
    });

    if (compact) {
        return (
            <div className="text-sm space-y-1">
                {filteredLogs.slice(0, 5).map(log => (
                    <div
                        key={log.log_id}
                        className="flex items-center gap-2 text-gray-600"
                    >
                        <span className="text-gray-400">{formatTimestamp(log.timestamp)}</span>
                        <span>{log.action_details}</span>
                    </div>
                ))}
                {filteredLogs.length > 5 && (
                    <div className="text-xs text-gray-500 italic">
                        +{filteredLogs.length - 5} more logs
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="border rounded-lg bg-white shadow-sm">
            {/* Header with Filters */}
            <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Audit Trail
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 text-sm rounded ${
                                filter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            All ({logs.length})
                        </button>
                        <button
                            onClick={() => setFilter('errors')}
                            className={`px-3 py-1 text-sm rounded ${
                                filter === 'errors'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Errors ({logs.filter(l => !l.success).length})
                        </button>
                        <button
                            onClick={() => setFilter('tools')}
                            className={`px-3 py-1 text-sm rounded ${
                                filter === 'tools'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                        >
                            Tools ({logs.filter(l => l.action_type === 'tool_call').length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs List */}
            <div className="divide-y max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No audit logs to display
                    </div>
                ) : (
                    filteredLogs.map(log => {
                        const isExpanded = expandedLogs.has(log.log_id);
                        const hasDetails = log.tool_input || log.tool_output || log.error_message;

                        return (
                            <div key={log.log_id} className="p-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-1">
                                        {getActionIcon(log.action_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">
                                                    {log.action_details}
                                                </span>
                                                {getStatusIcon(log.success)}
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {formatTimestamp(log.timestamp)}
                                            </span>
                                        </div>

                                        {/* Metadata */}
                                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                                            {log.tool_name && (
                                                <span className="flex items-center gap-1">
                                                    <Wrench className="w-3 h-3" />
                                                    {log.tool_name}
                                                </span>
                                            )}
                                            {log.tokens_used > 0 && (
                                                <span>{log.tokens_used} tokens</span>
                                            )}
                                            {log.cost > 0 && (
                                                <span>${log.cost.toFixed(4)}</span>
                                            )}
                                        </div>

                                        {/* Error Message */}
                                        {log.error_message && (
                                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                                                {log.error_message}
                                            </div>
                                        )}

                                        {/* Expandable Details */}
                                        {hasDetails && (
                                            <button
                                                onClick={() => toggleExpanded(log.log_id)}
                                                className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                {isExpanded ? (
                                                    <>
                                                        <ChevronUp className="w-3 h-3" />
                                                        Hide details
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        Show details
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="mt-2 space-y-2">
                                                {log.tool_input && (
                                                    <div className="text-xs">
                                                        <div className="font-medium text-gray-700 mb-1">
                                                            Input:
                                                        </div>
                                                        <pre className="p-2 bg-gray-50 border border-gray-200 rounded overflow-x-auto text-gray-800">
                                                            {JSON.stringify(log.tool_input, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                                {log.tool_output && (
                                                    <div className="text-xs">
                                                        <div className="font-medium text-gray-700 mb-1">
                                                            Output:
                                                        </div>
                                                        <pre className="p-2 bg-gray-50 border border-gray-200 rounded overflow-x-auto text-gray-800">
                                                            {JSON.stringify(log.tool_output, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
