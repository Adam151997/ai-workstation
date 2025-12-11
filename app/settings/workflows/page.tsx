// app/settings/workflows/page.tsx
// Workflow Management - List, create, and manage workflow templates
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Workflow,
    Plus,
    Play,
    Pause,
    Trash2,
    Edit,
    Copy,
    MoreVertical,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Search,
    Filter,
    BookOpen,
    Zap,
    Calendar,
    Globe,
    Lock,
    TrendingUp,
    BarChart3
} from 'lucide-react';

interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    triggerType: 'manual' | 'schedule' | 'webhook' | 'event';
    steps: any[];
    isActive: boolean;
    isPublic: boolean;
    mode: string;
    icon: string;
    color: string;
    tags: string[];
    runCount: number;
    lastRunAt: string | null;
    avgDurationMs: number | null;
    successRate: number;
    createdAt: string;
    updatedAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
    sales: { label: 'Sales', color: 'bg-green-100 text-green-700' },
    marketing: { label: 'Marketing', color: 'bg-purple-100 text-purple-700' },
    operations: { label: 'Operations', color: 'bg-blue-100 text-blue-700' },
    data: { label: 'Data', color: 'bg-cyan-100 text-cyan-700' },
    custom: { label: 'Custom', color: 'bg-gray-100 text-gray-700' },
};

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
    manual: <Play className="w-4 h-4" />,
    schedule: <Calendar className="w-4 h-4" />,
    webhook: <Globe className="w-4 h-4" />,
    event: <Zap className="w-4 h-4" />,
};

export default function WorkflowsPage() {
    const router = useRouter();
    const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // New workflow form state
    const [newWorkflow, setNewWorkflow] = useState({
        name: '',
        description: '',
        category: 'custom',
        triggerType: 'manual' as const,
        mode: 'Sales',
    });

    useEffect(() => {
        loadWorkflows();
    }, []);

    const loadWorkflows = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/workflows?includePublic=true');
            const data = await res.json();
            if (data.success) {
                setWorkflows(data.templates || []);
            }
        } catch (error) {
            console.error('Failed to load workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const createWorkflow = async () => {
        try {
            setActionLoading('create');
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newWorkflow,
                    steps: [],
                }),
            });
            const data = await res.json();
            if (data.success) {
                setShowCreateModal(false);
                setNewWorkflow({ name: '', description: '', category: 'custom', triggerType: 'manual', mode: 'Sales' });
                // Navigate to builder
                router.push(`/settings/workflows/builder?id=${data.id}`);
            } else {
                alert(data.error || 'Failed to create workflow');
            }
        } catch (error) {
            console.error('Failed to create workflow:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        
        try {
            setActionLoading(id);
            const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setWorkflows(prev => prev.filter(w => w.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const toggleActive = async (id: string, currentState: boolean) => {
        try {
            setActionLoading(id);
            const res = await fetch(`/api/workflows/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentState }),
            });
            const data = await res.json();
            if (data.success) {
                setWorkflows(prev => prev.map(w => 
                    w.id === id ? { ...w, isActive: !currentState } : w
                ));
            }
        } catch (error) {
            console.error('Failed to toggle workflow:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const runWorkflow = async (id: string) => {
        try {
            setActionLoading(id);
            const res = await fetch(`/api/workflows/${id}/run`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Workflow started! Check Background Jobs for progress.');
                loadWorkflows();
            } else {
                alert(data.error || 'Failed to run workflow');
            }
        } catch (error) {
            console.error('Failed to run workflow:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const duplicateWorkflow = async (workflow: WorkflowTemplate) => {
        try {
            setActionLoading(workflow.id);
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${workflow.name} (Copy)`,
                    description: workflow.description,
                    category: workflow.category,
                    triggerType: workflow.triggerType,
                    steps: workflow.steps,
                    mode: workflow.mode,
                }),
            });
            const data = await res.json();
            if (data.success) {
                loadWorkflows();
            }
        } catch (error) {
            console.error('Failed to duplicate workflow:', error);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredWorkflows = workflows.filter(w => {
        if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
        if (search) {
            const searchLower = search.toLowerCase();
            return w.name.toLowerCase().includes(searchLower) ||
                   w.description.toLowerCase().includes(searchLower);
        }
        return true;
    });

    const formatDuration = (ms: number | null) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Workflow className="w-6 h-6 text-purple-600" />
                        <div>
                            <h2 className="text-xl font-semibold">Workflow Builder</h2>
                            <p className="text-sm text-gray-500">
                                Create and manage automated workflows
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadWorkflows}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Workflow
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900">{workflows.length}</div>
                        <div className="text-sm text-gray-600">Total Workflows</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">
                            {workflows.filter(w => w.isActive).length}
                        </div>
                        <div className="text-sm text-green-600">Active</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">
                            {workflows.reduce((sum, w) => sum + w.runCount, 0)}
                        </div>
                        <div className="text-sm text-blue-600">Total Runs</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">
                            {workflows.length > 0 
                                ? Math.round(workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length)
                                : 0}%
                        </div>
                        <div className="text-sm text-purple-600">Avg Success Rate</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search workflows..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="all">All Categories</option>
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Workflows List */}
            <div className="bg-white rounded-lg border">
                {filteredWorkflows.length === 0 ? (
                    <div className="p-12 text-center">
                        <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
                        <p className="text-gray-600 mb-4">
                            {search || categoryFilter !== 'all'
                                ? 'Try adjusting your filters'
                                : 'Create your first workflow to automate tasks'
                            }
                        </p>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Workflow
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredWorkflows.map(workflow => (
                            <div key={workflow.id} className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div 
                                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: workflow.color + '20', color: workflow.color }}
                                        >
                                            <Workflow className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-medium text-gray-900">{workflow.name}</h4>
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    CATEGORY_CONFIG[workflow.category]?.color || 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {CATEGORY_CONFIG[workflow.category]?.label || workflow.category}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                                                    workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {workflow.isActive ? <CheckCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                                    {workflow.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                {workflow.isPublic && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                                                        <Globe className="w-3 h-3" />
                                                        Public
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1 truncate">
                                                {workflow.description || 'No description'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    {TRIGGER_ICONS[workflow.triggerType]}
                                                    {workflow.triggerType}
                                                </span>
                                                <span>{workflow.steps.length} steps</span>
                                                <span className="flex items-center gap-1">
                                                    <BarChart3 className="w-3 h-3" />
                                                    {workflow.runCount} runs
                                                </span>
                                                {workflow.avgDurationMs && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        ~{formatDuration(workflow.avgDurationMs)}
                                                    </span>
                                                )}
                                                <span className={workflow.successRate >= 90 ? 'text-green-600' : 
                                                               workflow.successRate >= 70 ? 'text-amber-600' : 'text-red-600'}>
                                                    {workflow.successRate}% success
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => runWorkflow(workflow.id)}
                                            disabled={actionLoading === workflow.id || !workflow.isActive}
                                            className="text-green-600 hover:bg-green-50"
                                        >
                                            {actionLoading === workflow.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`/settings/workflows/builder?id=${workflow.id}`)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => duplicateWorkflow(workflow)}
                                            disabled={actionLoading === workflow.id}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleActive(workflow.id, workflow.isActive)}
                                            disabled={actionLoading === workflow.id}
                                            className={workflow.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}
                                        >
                                            {workflow.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => deleteWorkflow(workflow.id)}
                                            disabled={actionLoading === workflow.id}
                                            className="text-red-600 hover:bg-red-50"
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

            {/* Create from Notebook CTA */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6">
                <div className="flex items-center gap-4">
                    <BookOpen className="w-10 h-10 text-purple-600" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">💡 Pro Tip: Turn Notebooks into Workflows</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Write and test your logic in a Notebook, then click "Turn into Workflow" to automate it.
                            This is the ultimate low-code to pro-code bridge!
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/settings/projects')}>
                        View Notebooks
                    </Button>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Workflow className="w-5 h-5 text-purple-600" />
                            Create New Workflow
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newWorkflow.name}
                                    onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    placeholder="My Workflow"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newWorkflow.description}
                                    onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    placeholder="What does this workflow do?"
                                    rows={2}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        value={newWorkflow.category}
                                        onChange={(e) => setNewWorkflow(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                            <option key={key} value={key}>{config.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
                                    <select
                                        value={newWorkflow.triggerType}
                                        onChange={(e) => setNewWorkflow(prev => ({ ...prev, triggerType: e.target.value as any }))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="schedule">Schedule</option>
                                        <option value="webhook">Webhook</option>
                                        <option value="event">Event</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                                <select
                                    value={newWorkflow.mode}
                                    onChange={(e) => setNewWorkflow(prev => ({ ...prev, mode: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="Sales">Sales</option>
                                    <option value="Marketing">Marketing</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={createWorkflow}
                                disabled={!newWorkflow.name || actionLoading === 'create'}
                            >
                                {actionLoading === 'create' ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4 mr-2" />
                                )}
                                Create & Edit
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
