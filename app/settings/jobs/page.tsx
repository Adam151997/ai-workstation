// app/settings/jobs/page.tsx
// Background Jobs monitoring page - Shows real job data from database
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
    Database,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    BookOpen,
    RotateCcw,
    StopCircle,
    Filter
} from 'lucide-react';

interface Job {
    id: string;
    type: 'workflow' | 'document' | 'etl' | 'notebook';
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    startedAt: string | null;
    completedAt: string | null;
    error?: string;
    metadata?: Record<string, any>;
}

interface JobStats {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending: number;
    byType?: {
        workflow: number;
        etl: number;
        notebook: number;
    };
}

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [stats, setStats] = useState<JobStats>({ total: 0, running: 0, completed: 0, failed: 0, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'completed' | 'failed' | 'pending'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'workflow' | 'etl' | 'notebook'>('all');
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadJobs();
        
        // Poll for updates every 5 seconds if auto-refresh is enabled
        let interval: NodeJS.Timeout | null = null;
        if (autoRefresh) {
            interval = setInterval(loadJobs, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    const loadJobs = async () => {
        try {
            const params = new URLSearchParams();
            if (typeFilter !== 'all') params.set('type', typeFilter);
            
            const res = await fetch(`/api/jobs?${params}`);
            const data = await res.json();
            
            if (data.success) {
                setJobs(data.jobs || []);
                setStats(data.stats || { total: 0, running: 0, completed: 0, failed: 0, pending: 0 });
            }
        } catch (error) {
            console.error('Failed to load jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const cancelJob = async (jobId: string, jobType: string) => {
        try {
            setActionLoading(jobId);
            const res = await fetch(`/api/jobs?jobId=${jobId}&type=${jobType}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
                loadJobs();
            } else {
                alert(data.error || 'Failed to cancel job');
            }
        } catch (error) {
            console.error('Failed to cancel job:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const retryJob = async (jobId: string, jobType: string) => {
        try {
            setActionLoading(jobId);
            const res = await fetch('/api/jobs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, jobType, action: 'retry' }),
            });
            const data = await res.json();
            if (data.success) {
                loadJobs();
            } else {
                alert(data.error || 'Failed to retry job');
            }
        } catch (error) {
            console.error('Failed to retry job:', error);
        } finally {
            setActionLoading(null);
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
            case 'notebook':
                return <BookOpen className="w-5 h-5 text-orange-600" />;
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
                return <StopCircle className="w-4 h-4 text-gray-600" />;
            default:
                return <Clock className="w-4 h-4 text-amber-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-800',
            running: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800',
            cancelled: 'bg-gray-100 text-gray-600',
        };
        return styles[status] || styles.pending;
    };

    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            workflow: 'bg-purple-100 text-purple-700',
            etl: 'bg-green-100 text-green-700',
            notebook: 'bg-orange-100 text-orange-700',
            document: 'bg-blue-100 text-blue-700',
        };
        return styles[type] || 'bg-gray-100 text-gray-600';
    };

    const formatDuration = (start: string | null, end: string | null) => {
        if (!start) return '-';
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
        
        if (seconds < 0) return '-';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const formatTime = (timestamp: string | null) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const toggleExpanded = (jobId: string) => {
        const newExpanded = new Set(expandedJobs);
        if (newExpanded.has(jobId)) {
            newExpanded.delete(jobId);
        } else {
            newExpanded.add(jobId);
        }
        setExpandedJobs(newExpanded);
    };

    const filteredJobs = jobs.filter(job => {
        if (statusFilter !== 'all' && job.status !== statusFilter) return false;
        return true;
    });

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
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded"
                            />
                            Auto-refresh
                        </label>
                        <Button
                            variant="outline"
                            onClick={loadJobs}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>
                <p className="text-gray-600">
                    Monitor long-running tasks: workflow executions, ETL syncs, and notebook runs.
                </p>

                {/* Stats by Status */}
                <div className="grid grid-cols-5 gap-4 mt-6">
                    <div 
                        className={`rounded-lg p-4 cursor-pointer transition ${
                            statusFilter === 'all' ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => setStatusFilter('all')}
                    >
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-sm text-gray-600">Total Jobs</div>
                    </div>
                    <div 
                        className={`rounded-lg p-4 cursor-pointer transition ${
                            statusFilter === 'pending' ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-amber-50 hover:bg-amber-100'
                        }`}
                        onClick={() => setStatusFilter('pending')}
                    >
                        <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                        <div className="text-sm text-amber-600">Pending</div>
                    </div>
                    <div 
                        className={`rounded-lg p-4 cursor-pointer transition ${
                            statusFilter === 'running' ? 'bg-blue-200 ring-2 ring-blue-400' : 'bg-blue-50 hover:bg-blue-100'
                        }`}
                        onClick={() => setStatusFilter('running')}
                    >
                        <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
                        <div className="text-sm text-blue-600">Running</div>
                    </div>
                    <div 
                        className={`rounded-lg p-4 cursor-pointer transition ${
                            statusFilter === 'completed' ? 'bg-green-200 ring-2 ring-green-400' : 'bg-green-50 hover:bg-green-100'
                        }`}
                        onClick={() => setStatusFilter('completed')}
                    >
                        <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                        <div className="text-sm text-green-600">Completed</div>
                    </div>
                    <div 
                        className={`rounded-lg p-4 cursor-pointer transition ${
                            statusFilter === 'failed' ? 'bg-red-200 ring-2 ring-red-400' : 'bg-red-50 hover:bg-red-100'
                        }`}
                        onClick={() => setStatusFilter('failed')}
                    >
                        <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                        <div className="text-sm text-red-600">Failed</div>
                    </div>
                </div>

                {/* Type Filter */}
                {stats.byType && (
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">Filter by type:</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-3 py-1 text-sm rounded-full transition ${
                                    typeFilter === 'all' 
                                        ? 'bg-gray-900 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                All ({stats.total})
                            </button>
                            <button
                                onClick={() => setTypeFilter('workflow')}
                                className={`px-3 py-1 text-sm rounded-full transition flex items-center gap-1 ${
                                    typeFilter === 'workflow' 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                            >
                                <Workflow className="w-3 h-3" />
                                Workflows ({stats.byType.workflow})
                            </button>
                            <button
                                onClick={() => setTypeFilter('etl')}
                                className={`px-3 py-1 text-sm rounded-full transition flex items-center gap-1 ${
                                    typeFilter === 'etl' 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                            >
                                <Database className="w-3 h-3" />
                                ETL Syncs ({stats.byType.etl})
                            </button>
                            <button
                                onClick={() => setTypeFilter('notebook')}
                                className={`px-3 py-1 text-sm rounded-full transition flex items-center gap-1 ${
                                    typeFilter === 'notebook' 
                                        ? 'bg-orange-600 text-white' 
                                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                            >
                                <BookOpen className="w-3 h-3" />
                                Notebooks ({stats.byType.notebook})
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-lg border">
                {filteredJobs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
                        <p className="text-gray-600">
                            {statusFilter === 'all' && typeFilter === 'all'
                                ? 'Background jobs will appear here when you run workflows, sync data, or execute notebooks.'
                                : `No ${statusFilter !== 'all' ? statusFilter : ''} ${typeFilter !== 'all' ? typeFilter : ''} jobs.`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredJobs.map(job => (
                            <div key={job.id} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            {getJobIcon(job.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                                <span className="truncate">{job.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(job.status)}`}>
                                                    {job.status}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded capitalize ${getTypeBadge(job.type)}`}>
                                                    {job.type}
                                                </span>
                                            </h4>
                                            <div className="text-sm text-gray-500 flex items-center gap-3 mt-1 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDuration(job.startedAt, job.completedAt)}
                                                </span>
                                                <span>Started: {formatTime(job.startedAt)}</span>
                                                {job.metadata && (
                                                    <>
                                                        {job.type === 'workflow' && job.metadata.stepsTotal && (
                                                            <span>
                                                                {job.metadata.stepsCompleted || 0}/{job.metadata.stepsTotal} steps
                                                            </span>
                                                        )}
                                                        {job.type === 'etl' && job.metadata.itemsFound !== undefined && (
                                                            <span>
                                                                {job.metadata.itemsProcessed || 0}/{job.metadata.itemsFound} items
                                                            </span>
                                                        )}
                                                        {job.type === 'notebook' && job.metadata.cellCount !== undefined && (
                                                            <span>
                                                                {job.metadata.cellsCompleted || 0}/{job.metadata.cellCount} cells
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {job.error && (
                                                <div className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    {job.error}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                        
                                        {/* Action Buttons */}
                                        {job.status === 'running' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => cancelJob(job.id, job.type)}
                                                disabled={actionLoading === job.id}
                                                className="text-red-600 hover:bg-red-50"
                                            >
                                                {actionLoading === job.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <StopCircle className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        {job.status === 'failed' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => retryJob(job.id, job.type)}
                                                disabled={actionLoading === job.id}
                                                className="text-blue-600 hover:bg-blue-50"
                                            >
                                                {actionLoading === job.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                        
                                        {getStatusIcon(job.status)}
                                        <button
                                            onClick={() => toggleExpanded(job.id)}
                                            className="p-1 hover:bg-gray-100 rounded"
                                        >
                                            {expandedJobs.has(job.id) ? (
                                                <ChevronUp className="w-4 h-4 text-gray-500" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-500" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {expandedJobs.has(job.id) && job.metadata && (
                                    <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-4 ml-14">
                                        <h5 className="text-sm font-medium text-gray-700 mb-2">Job Details</h5>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            {job.type === 'workflow' && (
                                                <>
                                                    <div>
                                                        <span className="text-gray-500">Total Steps:</span>
                                                        <span className="ml-2 font-medium">{job.metadata.stepsTotal || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Completed:</span>
                                                        <span className="ml-2 font-medium text-green-600">{job.metadata.stepsCompleted || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Failed:</span>
                                                        <span className="ml-2 font-medium text-red-600">{job.metadata.stepsFailed || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Tokens:</span>
                                                        <span className="ml-2 font-medium">{job.metadata.tokensUsed || 0}</span>
                                                    </div>
                                                </>
                                            )}
                                            {job.type === 'etl' && (
                                                <>
                                                    <div>
                                                        <span className="text-gray-500">Source:</span>
                                                        <span className="ml-2 font-medium capitalize">{job.metadata.sourceType}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Found:</span>
                                                        <span className="ml-2 font-medium">{job.metadata.itemsFound || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Created:</span>
                                                        <span className="ml-2 font-medium text-green-600">{job.metadata.itemsCreated || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Updated:</span>
                                                        <span className="ml-2 font-medium text-blue-600">{job.metadata.itemsUpdated || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Skipped:</span>
                                                        <span className="ml-2 font-medium text-gray-600">{job.metadata.itemsSkipped || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Failed:</span>
                                                        <span className="ml-2 font-medium text-red-600">{job.metadata.itemsFailed || 0}</span>
                                                    </div>
                                                </>
                                            )}
                                            {job.type === 'notebook' && (
                                                <>
                                                    <div>
                                                        <span className="text-gray-500">Total Cells:</span>
                                                        <span className="ml-2 font-medium">{job.metadata.cellCount || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Completed:</span>
                                                        <span className="ml-2 font-medium text-green-600">{job.metadata.cellsCompleted || 0}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Failed:</span>
                                                        <span className="ml-2 font-medium text-red-600">{job.metadata.cellsFailed || 0}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-3 text-xs text-gray-400 font-mono">
                                            ID: {job.id}
                                        </div>
                                    </div>
                                )}
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
