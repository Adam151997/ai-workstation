// components/BackgroundJobsPanel.tsx
// UI component for displaying and managing background jobs

'use client';

import { useState } from 'react';
import { useBackgroundJobs, BackgroundJob } from '@/hooks/useBackgroundJobs';
import {
    Loader2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Zap,
} from 'lucide-react';

interface BackgroundJobsPanelProps {
    compact?: boolean;
}

export function BackgroundJobsPanel({ compact = false }: BackgroundJobsPanelProps) {
    const { jobs, isLoading, error, refreshJobs, hasRunningJobs } = useBackgroundJobs();
    const [expanded, setExpanded] = useState(!compact);

    const getStatusIcon = (status: BackgroundJob['status']) => {
        switch (status) {
            case 'running':
                return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-600" />;
            case 'partial':
                return <AlertCircle className="w-4 h-4 text-yellow-600" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: BackgroundJob['status']) => {
        switch (status) {
            case 'running': return 'bg-blue-100 text-blue-800';
            case 'success': return 'bg-green-100 text-green-800';
            case 'failed': return 'bg-red-100 text-red-800';
            case 'partial': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (compact && jobs.length === 0) {
        return null;
    }

    return (
        <div className="bg-white border rounded-lg shadow-sm">
            {/* Header */}
            <div 
                className="p-3 border-b bg-gray-50 flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm">Background Jobs</span>
                    {hasRunningJobs && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full animate-pulse">
                            {jobs.filter(j => j.status === 'running').length} running
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            refreshJobs();
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-600" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                    )}
                </div>
            </div>

            {/* Content */}
            {expanded && (
                <div className="divide-y max-h-64 overflow-y-auto">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm">
                            Error: {error}
                        </div>
                    )}

                    {jobs.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">
                            No background jobs running
                        </div>
                    ) : (
                        jobs.map((job) => (
                            <div key={job.executionId} className="p-3 hover:bg-gray-50">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                        {getStatusIcon(job.status)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-gray-900 truncate">
                                                    {job.workflowName}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(job.status)}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                            
                                            {/* Progress bar */}
                                            {job.status === 'running' && (
                                                <div className="mt-2">
                                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                                        <span>{job.progress.completed}/{job.progress.total} steps</span>
                                                        <span>{job.progress.percentage}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                        <div
                                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                                            style={{ width: `${job.progress.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Completed info */}
                                            {job.status !== 'running' && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {job.progress.completed}/{job.progress.total} steps completed
                                                    {job.progress.failed && job.progress.failed > 0 && (
                                                        <span className="text-red-600 ml-2">
                                                            ({job.progress.failed} failed)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {formatTime(job.startedAt)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default BackgroundJobsPanel;
