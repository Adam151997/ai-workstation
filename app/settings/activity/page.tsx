// app/settings/activity/page.tsx
// Activity/Audit Logs page - Enhanced with all resource types
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
    User,
    BookOpen,
    Wrench,
    Package,
    Play,
    CheckCircle,
    XCircle,
    Bot,
    Brain,
    Database,
    Zap,
    GitBranch,
    Pause,
    RotateCcw,
    Link,
    Unlink,
    FolderOpen,
    Tag,
    BarChart3,
    Copy
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
    // Document actions
    'document.upload': <Upload className="w-4 h-4 text-green-600" />,
    'document.update': <Edit className="w-4 h-4 text-blue-600" />,
    'document.delete': <Trash className="w-4 h-4 text-red-600" />,
    'document.view': <FileText className="w-4 h-4 text-gray-600" />,
    'document.download': <Download className="w-4 h-4 text-blue-600" />,
    // Chat actions
    'chat.message': <MessageSquare className="w-4 h-4 text-purple-600" />,
    'chat.tool_call': <Wrench className="w-4 h-4 text-orange-600" />,
    // Project actions
    'project.create': <FolderOpen className="w-4 h-4 text-green-600" />,
    'project.update': <Edit className="w-4 h-4 text-blue-600" />,
    'project.delete': <Trash className="w-4 h-4 text-red-600" />,
    'project.archive': <FolderOpen className="w-4 h-4 text-gray-600" />,
    // Tag actions
    'tag.create': <Tag className="w-4 h-4 text-amber-600" />,
    'tag.update': <Edit className="w-4 h-4 text-amber-600" />,
    'tag.delete': <Trash className="w-4 h-4 text-red-600" />,
    // Settings actions
    'settings.tools_update': <Settings className="w-4 h-4 text-gray-600" />,
    'settings.update': <Settings className="w-4 h-4 text-gray-600" />,
    // User actions
    'user.login': <LogIn className="w-4 h-4 text-blue-600" />,
    'user.logout': <LogIn className="w-4 h-4 text-gray-600" />,
    // Search actions
    'search.query': <Search className="w-4 h-4 text-blue-600" />,
    'rag.search': <Search className="w-4 h-4 text-purple-600" />,
    // Artifact actions
    'artifact.create': <BarChart3 className="w-4 h-4 text-green-600" />,
    'artifact.export': <Download className="w-4 h-4 text-blue-600" />,
    // Notebook actions (NEW)
    'notebook.create': <BookOpen className="w-4 h-4 text-green-600" />,
    'notebook.update': <Edit className="w-4 h-4 text-blue-600" />,
    'notebook.delete': <Trash className="w-4 h-4 text-red-600" />,
    'notebook.cell_execute': <Play className="w-4 h-4 text-purple-600" />,
    'notebook.run_all': <Play className="w-4 h-4 text-blue-600" />,
    'notebook.run_complete': <CheckCircle className="w-4 h-4 text-green-600" />,
    'notebook.run_failed': <XCircle className="w-4 h-4 text-red-600" />,
    'notebook.share': <Link className="w-4 h-4 text-blue-600" />,
    'notebook.duplicate': <Copy className="w-4 h-4 text-gray-600" />,
    // Toolkit actions (NEW)
    'toolkit.install': <Package className="w-4 h-4 text-green-600" />,
    'toolkit.uninstall': <Package className="w-4 h-4 text-red-600" />,
    'toolkit.configure': <Settings className="w-4 h-4 text-blue-600" />,
    'toolkit.enable': <CheckCircle className="w-4 h-4 text-green-600" />,
    'toolkit.disable': <XCircle className="w-4 h-4 text-gray-600" />,
    // Tool execution actions (NEW)
    'tool.execute': <Wrench className="w-4 h-4 text-blue-600" />,
    'tool.success': <CheckCircle className="w-4 h-4 text-green-600" />,
    'tool.failed': <XCircle className="w-4 h-4 text-red-600" />,
    // Workflow actions (NEW)
    'workflow.create': <GitBranch className="w-4 h-4 text-green-600" />,
    'workflow.update': <Edit className="w-4 h-4 text-blue-600" />,
    'workflow.delete': <Trash className="w-4 h-4 text-red-600" />,
    'workflow.execute': <Play className="w-4 h-4 text-blue-600" />,
    'workflow.complete': <CheckCircle className="w-4 h-4 text-green-600" />,
    'workflow.failed': <XCircle className="w-4 h-4 text-red-600" />,
    'workflow.pause': <Pause className="w-4 h-4 text-amber-600" />,
    'workflow.resume': <RotateCcw className="w-4 h-4 text-blue-600" />,
    // Agent actions (NEW)
    'agent.route': <Bot className="w-4 h-4 text-purple-600" />,
    'agent.execute': <Zap className="w-4 h-4 text-blue-600" />,
    'agent.delegate': <Bot className="w-4 h-4 text-amber-600" />,
    // Memory actions (NEW)
    'memory.store': <Brain className="w-4 h-4 text-purple-600" />,
    'memory.delete': <Trash className="w-4 h-4 text-red-600" />,
    'memory.consolidate': <Brain className="w-4 h-4 text-blue-600" />,
    // Data source actions (NEW)
    'datasource.connect': <Link className="w-4 h-4 text-green-600" />,
    'datasource.disconnect': <Unlink className="w-4 h-4 text-red-600" />,
    'datasource.sync': <Database className="w-4 h-4 text-blue-600" />,
    'datasource.sync_complete': <CheckCircle className="w-4 h-4 text-green-600" />,
    'datasource.sync_failed': <XCircle className="w-4 h-4 text-red-600" />,
};

const ACTION_LABELS: Record<string, string> = {
    // Document actions
    'document.upload': 'Uploaded document',
    'document.update': 'Updated document',
    'document.delete': 'Deleted document',
    'document.view': 'Viewed document',
    'document.download': 'Downloaded document',
    // Chat actions
    'chat.message': 'Sent message',
    'chat.tool_call': 'Called tool',
    // Project actions
    'project.create': 'Created project',
    'project.update': 'Updated project',
    'project.delete': 'Deleted project',
    'project.archive': 'Archived project',
    // Tag actions
    'tag.create': 'Created tag',
    'tag.update': 'Updated tag',
    'tag.delete': 'Deleted tag',
    // Settings actions
    'settings.tools_update': 'Updated tools',
    'settings.update': 'Updated settings',
    // User actions
    'user.login': 'Logged in',
    'user.logout': 'Logged out',
    // Search actions
    'search.query': 'Searched documents',
    'rag.search': 'RAG search',
    // Artifact actions
    'artifact.create': 'Created artifact',
    'artifact.export': 'Exported artifact',
    // Notebook actions (NEW)
    'notebook.create': 'Created notebook',
    'notebook.update': 'Updated notebook',
    'notebook.delete': 'Deleted notebook',
    'notebook.cell_execute': 'Executed cell',
    'notebook.run_all': 'Ran all cells',
    'notebook.run_complete': 'Notebook run completed',
    'notebook.run_failed': 'Notebook run failed',
    'notebook.share': 'Shared notebook',
    'notebook.duplicate': 'Duplicated notebook',
    // Toolkit actions (NEW)
    'toolkit.install': 'Installed toolkit',
    'toolkit.uninstall': 'Uninstalled toolkit',
    'toolkit.configure': 'Configured toolkit',
    'toolkit.enable': 'Enabled toolkit',
    'toolkit.disable': 'Disabled toolkit',
    // Tool execution actions (NEW)
    'tool.execute': 'Executed tool',
    'tool.success': 'Tool succeeded',
    'tool.failed': 'Tool failed',
    // Workflow actions (NEW)
    'workflow.create': 'Created workflow',
    'workflow.update': 'Updated workflow',
    'workflow.delete': 'Deleted workflow',
    'workflow.execute': 'Started workflow',
    'workflow.complete': 'Workflow completed',
    'workflow.failed': 'Workflow failed',
    'workflow.pause': 'Paused workflow',
    'workflow.resume': 'Resumed workflow',
    // Agent actions (NEW)
    'agent.route': 'Agent routed query',
    'agent.execute': 'Agent executed',
    'agent.delegate': 'Agent delegated',
    // Memory actions (NEW)
    'memory.store': 'Stored memory',
    'memory.delete': 'Deleted memory',
    'memory.consolidate': 'Consolidated memories',
    // Data source actions (NEW)
    'datasource.connect': 'Connected data source',
    'datasource.disconnect': 'Disconnected data source',
    'datasource.sync': 'Started sync',
    'datasource.sync_complete': 'Sync completed',
    'datasource.sync_failed': 'Sync failed',
};

const RESOURCE_FILTERS = [
    { value: 'all', label: 'All activities' },
    { value: 'document', label: '📄 Documents' },
    { value: 'chat', label: '💬 Chat' },
    { value: 'notebook', label: '📓 Notebooks' },
    { value: 'toolkit', label: '🧰 Toolkits' },
    { value: 'tool', label: '🔧 Tools' },
    { value: 'workflow', label: '🔀 Workflows' },
    { value: 'agent', label: '🤖 Agents' },
    { value: 'memory', label: '🧠 Memory' },
    { value: 'datasource', label: '💾 Data Sources' },
    { value: 'project', label: '📁 Projects' },
    { value: 'artifact', label: '📊 Artifacts' },
];

export default function ActivityPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [resourceFilter, setResourceFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState<Record<string, number>>({});

    useEffect(() => {
        loadLogs();
    }, [resourceFilter, page]);

    useEffect(() => {
        loadStats();
    }, []);

    const loadLogs = async () => {
        try {
            setLoading(true);
            
            const params = new URLSearchParams({
                limit: '50',
                offset: ((page - 1) * 50).toString(),
            });
            if (resourceFilter !== 'all') {
                params.set('resource', resourceFilter);
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

    const loadStats = async () => {
        try {
            const res = await fetch('/api/audit/stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 0) return 'Just now';
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

    const getResourceBadgeColor = (resource: string) => {
        const colors: Record<string, string> = {
            document: 'bg-blue-100 text-blue-700',
            chat: 'bg-purple-100 text-purple-700',
            notebook: 'bg-green-100 text-green-700',
            toolkit: 'bg-orange-100 text-orange-700',
            tool: 'bg-amber-100 text-amber-700',
            workflow: 'bg-indigo-100 text-indigo-700',
            agent: 'bg-pink-100 text-pink-700',
            memory: 'bg-violet-100 text-violet-700',
            datasource: 'bg-cyan-100 text-cyan-700',
            project: 'bg-emerald-100 text-emerald-700',
            artifact: 'bg-rose-100 text-rose-700',
        };
        return colors[resource] || 'bg-gray-100 text-gray-700';
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
                                loadStats();
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
                    Track all actions in your workspace including notebooks, toolkits, workflows, and agents.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries(stats).slice(0, 6).map(([resource, count]) => (
                    <div key={resource} className="bg-white rounded-lg border p-4">
                        <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getResourceBadgeColor(resource)}`}>
                            {resource}
                        </div>
                        <p className="text-2xl font-bold mt-2">{count}</p>
                        <p className="text-xs text-gray-500">actions today</p>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500" />
                <div className="flex flex-wrap gap-2">
                    {RESOURCE_FILTERS.map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => {
                                setResourceFilter(filter.value);
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm transition ${
                                resourceFilter === filter.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
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
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-gray-900">
                                                        {getActionLabel(log.action)}
                                                    </h4>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getResourceBadgeColor(log.resource)}`}>
                                                        {log.resource}
                                                    </span>
                                                </div>
                                                <span className="text-sm text-gray-500">
                                                    {formatTime(log.createdAt)}
                                                </span>
                                            </div>
                                            {log.resourceId && (
                                                <div className="text-sm text-gray-500 mt-1 font-mono">
                                                    ID: {log.resourceId.length > 20 
                                                        ? `${log.resourceId.substring(0, 20)}...` 
                                                        : log.resourceId}
                                                </div>
                                            )}
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
                                                <details className="mt-2">
                                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                                        View details
                                                    </summary>
                                                    <div className="mt-1 text-xs text-gray-500 bg-gray-50 rounded p-2 font-mono overflow-x-auto">
                                                        {JSON.stringify(log.metadata, null, 2)}
                                                    </div>
                                                </details>
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
