// app/settings/jobs/page.tsx
// Background Jobs monitoring page
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Zap,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    ExternalLink,
    Play,
    Pause,
    FileText,
    Workflow,
    Database
} from 'lucide-react';

interface Job {
    id: string;
    type: 'workflow' | 'document' | 'etl';
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    startedAt: string | null;
    completedAt: string | null;
    error?: string;
    metadata?: Record<string, any>;
}

// Mock data for now - in production, this would come from Trigger.dev API
const MOCK_JOBS: Job[] = [
    {
        id: '1',
        type: 'workflow',
        name: 'Sales Report Generation',
        status: 'completed',
        startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        metadata: { steps: 5, tokensUsed: 2500 },
    },
    {
        id: '2',
        type: 'document',
        name: 'Bulk Document Processing',
        status: 'running',
        progress: 65,
        startedAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        completedAt: null,
        metadata: { total: 20, processed: 13 },
    },
    {
        id: '3',
        type: 'etl',
        name: 'Google Drive Sync',
        status: 'failed',
        startedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        error: 'Authentication expired',
    },
];

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');

    useEffect(() => {
        loadJobs();
        
        // Poll for updates every 5 seconds
        const interval = setInterval(loadJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadJobs = async () => {
        try {
            // TODO: Fetch from actual API
            // const res = await fetch('/api/jobs');
            // const data = await res.json();
            
            // For now, use mock data
            setJobs(MOCK_JOBS);
        } catch (error) {
            console.error('Failed to load jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getJobIcon = (type: string) => {
        switch (type) {
            case 'workflow':
                return <Workflow className="w-5 h-5 text-purple-600" />;
            case 'document':
                return <FileText className="w-5 h-5 text-blue-600" />;
            case 'etl':
                return <Database className="w-5 h-5 text-green-600" />;
            default:
                return <Zap className="w-5 h-5 text-gray-600" />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'running':
                return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
            case 'failed':
                return <XCircle className="w-4 h-4 text-red-600" />;
            case 'cancelled':
                return <Pause className="w-4 h-4 text-gray-600" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-gray-100 text-gray-800',
            running: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            cancelled: 'bg-gray-100 text-gray-600',
        };
        return styles[status] || styles.pending;
    };

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start) return '-';
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
        
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const filteredJobs = jobs.filter(job => {
        if (filter === 'all') return true;
        return job.status === filter;
    });

    const runningCount = jobs.filter(j => j.status === 'running').length;
    const completedCount = jobs.filter(j => j.status === 'completed').length;
    const failedCount = jobs.filter(j => j.status === 'failed').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold">Background Jobs</h2>
                    </div>
                    <Button
                        variant="outline"
                        onClick={loadJobs}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
                <p className="text-gray-600">
                    Monitor long-running tasks like workflow executions, document processing, and data syncs.
                </p>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
                        <div className="text-sm text-gray-600">Total Jobs</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">{runningCount}</div>
                        <div className="text-sm text-blue-600">Running</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">{completedCount}</div>
                        <div className="text-sm text-green-600">Completed</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                        <div className="text-sm text-red-600">Failed</div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['all', 'running', 'completed', 'failed'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filter === status
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border'
                        }`}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                ))}
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-lg border">
                {filteredJobs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                        <p className="text-gray-600">
                            {filter === 'all' 
                                ? 'Background jobs will appear here when you run workflows or sync data.'
                                : `No ${filter} jobs.`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredJobs.map(job => (
                            <div key={job.id} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                            {getJobIcon(job.type)}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                                {job.name}
                                                <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(job.status)}`}>
                                                    {job.status}
                                                </span>
                                            </h4>
                                            <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                                                <span className="capitalize">{job.type}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDuration(job.startedAt, job.completedAt)}
                                                </span>
                                                {job.metadata && (
                                                    <>
                                                        <span>•</span>
                                                        <span>
                                                            {job.type === 'workflow' && `${job.metadata.steps} steps`}
                                                            {job.type === 'document' && `${job.metadata.processed}/${job.metadata.total} docs`}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            {job.error && (
                                                <div className="text-sm text-red-600 mt-1">
                                                    Error: {job.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {job.status === 'running' && job.progress !== undefined && (
                                            <div className="w-32">
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-blue-600 transition-all duration-300"
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-500 text-center mt-1">
                                                    {job.progress}%
                                                </div>
                                            </div>
                                        )}
                                        {getStatusIcon(job.status)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Trigger.dev Link */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                            ⚡ Powered by Trigger.dev
                        </h3>
                        <p className="text-sm text-gray-600">
                            View detailed logs, retry failed jobs, and manage your background tasks.
                        </p>
                    </div>
                    <a 
                        href="https://cloud.trigger.dev" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border hover:shadow-sm transition-shadow"
                    >
                        Open Dashboard
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}
