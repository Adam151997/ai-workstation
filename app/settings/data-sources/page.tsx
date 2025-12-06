// app/settings/data-sources/page.tsx
// Data Sources management page - ETL connections
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Database,
    Plus, 
    Edit2, 
    Trash2, 
    Loader2,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Play,
    Pause,
    ExternalLink
} from 'lucide-react';

// Source type icons (using text for now, could use actual logos)
const SOURCE_ICONS: Record<string, { label: string; color: string }> = {
    google_drive: { label: '📁', color: '#4285F4' },
    gmail: { label: '📧', color: '#EA4335' },
    notion: { label: '📝', color: '#000000' },
    slack: { label: '💬', color: '#4A154B' },
    dropbox: { label: '📦', color: '#0061FF' },
    onedrive: { label: '☁️', color: '#0078D4' },
};

interface DataSource {
    id: string;
    name: string;
    sourceType: string;
    connectionStatus: 'connected' | 'disconnected' | 'error' | 'syncing';
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
    totalItemsSynced: number;
    syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly';
    isActive: boolean;
    itemCount: number;
    runningJobs: number;
    createdAt: string;
}

interface SyncJob {
    id: string;
    dataSourceId: string;
    sourceName: string;
    sourceType: string;
    jobType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    itemsProcessed: number;
    itemsFailed: number;
    errorMessage: string | null;
}

export default function DataSourcesPage() {
    const [dataSources, setDataSources] = useState<DataSource[]>([]);
    const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        sourceType: 'google_drive',
        syncFrequency: 'manual',
    });
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [sourcesRes, jobsRes] = await Promise.all([
                fetch('/api/data-sources'),
                fetch('/api/data-sources/sync?limit=10'),
            ]);
            
            const sourcesData = await sourcesRes.json();
            const jobsData = await jobsRes.json();
            
            if (sourcesData.success) {
                setDataSources(sourcesData.dataSources);
            }
            if (jobsData.success) {
                setSyncJobs(jobsData.syncJobs);
            }
        } catch (error) {
            console.error('Failed to load data sources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name.trim()) return;
        
        try {
            setSaving(true);
            const res = await fetch('/api/data-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            
            if (data.success) {
                setDataSources(prev => [...prev, data.dataSource]);
                setIsCreating(false);
                setFormData({ name: '', sourceType: 'google_drive', syncFrequency: 'manual' });
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to create data source:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async (dataSource: DataSource) => {
        try {
            setSyncing(dataSource.id);
            const res = await fetch('/api/data-sources/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataSourceId: dataSource.id,
                    jobType: 'manual',
                }),
            });
            const data = await res.json();
            
            if (data.success) {
                // Refresh data
                await loadData();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to start sync:', error);
        } finally {
            setSyncing(null);
        }
    };

    const handleDelete = async (dataSource: DataSource) => {
        if (!confirm(`Delete "${dataSource.name}"? This will remove all synced items.`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/data-sources?id=${dataSource.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            
            if (data.success) {
                setDataSources(prev => prev.filter(ds => ds.id !== dataSource.id));
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to delete data source:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected':
                return <CheckCircle className="w-4 h-4 text-green-600" />;
            case 'syncing':
                return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-600" />;
            default:
                return <AlertCircle className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'connected': return 'Connected';
            case 'syncing': return 'Syncing...';
            case 'error': return 'Error';
            default: return 'Disconnected';
        }
    };

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
                        <Database className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold">Data Sources</h2>
                    </div>
                    <Button
                        onClick={() => setIsCreating(true)}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Source
                    </Button>
                </div>
                <p className="text-gray-600">
                    Connect external data sources to automatically sync documents into your workspace.
                </p>
            </div>

            {/* Create Form */}
            {isCreating && (
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="font-semibold mb-4">Add Data Source</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="My Google Drive"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Source Type
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {Object.entries(SOURCE_ICONS).map(([type, { label, color }]) => (
                                    <button
                                        key={type}
                                        onClick={() => setFormData(prev => ({ ...prev, sourceType: type }))}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            formData.sourceType === type
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="text-2xl mb-1">{label}</div>
                                        <div className="text-sm font-medium capitalize">
                                            {type.replace('_', ' ')}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Sync Frequency
                            </label>
                            <select
                                value={formData.syncFrequency}
                                onChange={(e) => setFormData(prev => ({ ...prev, syncFrequency: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="manual">Manual only</option>
                                <option value="hourly">Every hour</option>
                                <option value="daily">Once a day</option>
                                <option value="weekly">Once a week</option>
                            </select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                onClick={handleCreate}
                                disabled={saving || !formData.name.trim()}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : 'Create Source'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setIsCreating(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Sources List */}
            <div className="bg-white rounded-lg border">
                {dataSources.length === 0 ? (
                    <div className="p-12 text-center">
                        <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No data sources</h3>
                        <p className="text-gray-600 mb-4">Connect your first external data source.</p>
                        <Button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Source
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y">
                        {dataSources.map(ds => (
                            <div key={ds.id} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                            style={{ backgroundColor: `${SOURCE_ICONS[ds.sourceType]?.color}15` }}
                                        >
                                            {SOURCE_ICONS[ds.sourceType]?.label || '📄'}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                                {ds.name}
                                                <span className="flex items-center gap-1 text-sm font-normal">
                                                    {getStatusIcon(ds.connectionStatus)}
                                                    <span className="text-gray-500">
                                                        {getStatusText(ds.connectionStatus)}
                                                    </span>
                                                </span>
                                            </h4>
                                            <div className="text-sm text-gray-500 capitalize">
                                                {ds.sourceType.replace('_', ' ')} • {ds.itemCount} items synced
                                            </div>
                                            {ds.lastSyncAt && (
                                                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                    <Clock className="w-3 h-3" />
                                                    Last sync: {new Date(ds.lastSyncAt).toLocaleString()}
                                                </div>
                                            )}
                                            {ds.lastSyncError && (
                                                <div className="text-xs text-red-600 mt-1">
                                                    {ds.lastSyncError}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSync(ds)}
                                            disabled={syncing === ds.id || ds.connectionStatus === 'syncing'}
                                        >
                                            {syncing === ds.id || ds.connectionStatus === 'syncing' ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                    Syncing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4 mr-2" />
                                                    Sync Now
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(ds)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Sync Jobs */}
            {syncJobs.length > 0 && (
                <div className="bg-white rounded-lg border">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold">Recent Sync Jobs</h3>
                    </div>
                    <div className="divide-y">
                        {syncJobs.slice(0, 5).map(job => (
                            <div key={job.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="text-xl">
                                        {SOURCE_ICONS[job.sourceType]?.label || '📄'}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{job.sourceName}</div>
                                        <div className="text-xs text-gray-500">
                                            {job.jobType} • {job.itemsProcessed} items
                                            {job.itemsFailed > 0 && (
                                                <span className="text-red-600 ml-1">
                                                    ({job.itemsFailed} failed)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        job.status === 'completed' 
                                            ? 'bg-green-100 text-green-800'
                                            : job.status === 'failed'
                                            ? 'bg-red-100 text-red-800'
                                            : job.status === 'running'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        {job.status}
                                    </span>
                                    {job.startedAt && (
                                        <span className="text-xs text-gray-400">
                                            {new Date(job.startedAt).toLocaleTimeString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Sync Requirements</h3>
                <p className="text-sm text-blue-800">
                    To sync data from external sources, you need to connect the corresponding 
                    tools in the <strong>Toolkit Store</strong>. For example, install "Google Drive" 
                    to sync files from Google Drive. The sync uses your authenticated connection 
                    via Composio.
                </p>
            </div>
        </div>
    );
}
