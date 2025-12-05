// app/settings/activity/page.tsx
// Activity/Audit Logs page
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Activity,
    RefreshCw,
    Loader2,
    FileText,
    MessageSquare,
    Settings,
    Upload,
    Trash,
    Edit,
    LogIn,
    Search,
    Download,
    Filter,
    User
} from 'lucide-react';

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId: string | null;
    metadata: Record<string, any>;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
    'document.upload': <Upload className="w-4 h-4 text-green-600" />,
    'document.delete': <Trash className="w-4 h-4 text-red-600" />,
    'document.process': <FileText className="w-4 h-4 text-blue-600" />,
    'chat.message': <MessageSquare className="w-4 h-4 text-purple-600" />,
    'settings.update': <Settings className="w-4 h-4 text-gray-600" />,
    'user.login': <LogIn className="w-4 h-4 text-blue-600" />,
    'project.create': <Edit className="w-4 h-4 text-green-600" />,
    'tag.create': <Edit className="w-4 h-4 text-amber-600" />,
    'search.query': <Search className="w-4 h-4 text-blue-600" />,
};

const ACTION_LABELS: Record<string, string> = {
    'document.upload': 'Uploaded document',
    'document.delete': 'Deleted document',
    'document.process': 'Processed document',
    'chat.message': 'Sent message',
    'settings.update': 'Updated settings',
    'user.login': 'Logged in',
    'project.create': 'Created project',
    'tag.create': 'Created tag',
    'search.query': 'Searched documents',
};

export default function ActivityPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadLogs();
    }, [filter, page]);

    const loadLogs = async () => {
        try {
            setLoading(true);
            
            // Fetch from API
            const params = new URLSearchParams({
                limit: '50',
                offset: ((page - 1) * 50).toString(),
            });
            if (filter !== 'all') {
                params.set('action', filter);
            }
            
            const res = await fetch(`/api/audit?${params}`);
            const data = await res.json();
            
            if (data.success) {
                if (page === 1) {
                    setLogs(data.logs);
                } else {
                    setLogs(prev => [...prev, ...data.logs]);
                }
                setHasMore(data.logs.length === 50);
            }
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        // ISO strings with 'Z' suffix are properly parsed as UTC by JavaScript
        const date = new Date(timestamp);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 0) return 'Just now'; // Handle slight clock differences
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getActionIcon = (action: string) => {
        return ACTION_ICONS[action] || <Activity className="w-4 h-4 text-gray-500" />;
    };

    const getActionLabel = (action: string) => {
        return ACTION_LABELS[action] || action;
    };

    const exportLogs = async () => {
        try {
            const res = await fetch('/api/audit/export');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } catch (error) {
            console.error('Failed to export logs:', error);
        }
    };

    const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Activity className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold">Activity Log</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setPage(1);
                                loadLogs();
                            }}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            onClick={exportLogs}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
                <p className="text-gray-600">
                    Track all actions in your workspace for security and compliance.
                </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All activities</option>
                    {uniqueActions.map(action => (
                        <option key={action} value={action}>
                            {getActionLabel(action)}
                        </option>
                    ))}
                </select>
            </div>

            {/* Logs List */}
            <div className="bg-white rounded-lg border">
                {loading && page === 1 ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                        <p className="text-gray-600">
                            Your actions will be logged here for security and compliance.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y">
                            {logs.map((log, index) => (
                                <div key={log.id || index} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-medium text-gray-900">
                                                    {getActionLabel(log.action)}
                                                </h4>
                                                <span className="text-sm text-gray-500">
                                                    {formatTime(log.createdAt)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 mt-1">
                                                {log.resource}
                                                {log.resourceId && (
                                                    <span className="text-gray-400 ml-1">
                                                        ({log.resourceId.substring(0, 8)}...)
                                                    </span>
                                                )}
                                            </div>
                                            {/* User & IP Info */}
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {log.userId?.substring(0, 12)}...
                                                </span>
                                                {log.ipAddress && log.ipAddress !== 'unknown' && (
                                                    <span>IP: {log.ipAddress}</span>
                                                )}
                                            </div>
                                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 font-mono">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More */}
                        {hasMore && (
                            <div className="p-4 border-t text-center">
                                <Button
                                    variant="outline"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More'
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Retention Notice */}
            <div className="bg-gray-50 rounded-lg border p-4 text-sm text-gray-600">
                <strong>📋 Retention Policy:</strong> Audit logs are retained for 90 days. 
                Export regularly for long-term compliance needs.
            </div>
        </div>
    );
}
