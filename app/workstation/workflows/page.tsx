// app/workstation/workflows/page.tsx
// Workflow Builder - List and manage workflows
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
    Workflow,
    Plus,
    Search,
    Filter,
    Play,
    Edit,
    Trash2,
    Copy,
    MoreVertical,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    FileText,
    Zap,
    Database,
    Globe,
    ChevronLeft,
    RefreshCw,
    Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowTemplate {
    id: string;
    userId: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
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

const CATEGORY_ICONS: Record<string, any> = {
    research: Search,
    content: FileText,
    data: Database,
    custom: Zap,
};

const CATEGORY_LABELS: Record<string, string> = {
    all: 'All Workflows',
    research: 'Research',
    content: 'Content',
    data: 'Data Processing',
    custom: 'Custom',
};

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);

    useEffect(() => {
        loadWorkflows();
    }, [category]);

    const loadWorkflows = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                includePublic: 'true',
            });
            if (category !== 'all') {
                params.set('category', category);
            }
            
            const res = await fetch(`/api/workflows?${params}`);
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

    const runWorkflow = async (id: string) => {
        try {
            setRunningWorkflow(id);
            
            // For now, run with empty inputs - in a real app, show input modal
            const res = await fetch(`/api/workflows/${id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: {} }),
            });
            
            const data = await res.json();
            
            if (data.success) {
                alert(`Workflow completed successfully!\n\nDuration: ${data.durationMs}ms`);
            } else {
                alert(`Workflow failed: ${data.error?.message || 'Unknown error'}`);
            }
            
            // Refresh to update run count
            loadWorkflows();
        } catch (error) {
            console.error('Failed to run workflow:', error);
            alert('Failed to run workflow');
        } finally {
            setRunningWorkflow(null);
        }
    };

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;
        
        try {
            const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadWorkflows();
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        }
    };

    const duplicateWorkflow = async (workflow: WorkflowTemplate) => {
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `${workflow.name} (Copy)`,
                    description: workflow.description,
                    category: workflow.category,
                    steps: workflow.steps,
                    mode: workflow.mode,
                    icon: workflow.icon,
                    color: workflow.color,
                    tags: workflow.tags,
                }),
            });
            
            if (res.ok) {
                loadWorkflows();
            }
        } catch (error) {
            console.error('Failed to duplicate workflow:', error);
        }
    };

    const filteredWorkflows = workflows.filter(w => 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDuration = (ms: number | null) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link 
                                href="/workstation"
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-2">
                                <Workflow className="w-6 h-6 text-blue-600" />
                                <h1 className="text-xl font-semibold text-gray-900">Workflow Builder</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={loadWorkflows}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Link href="/workstation/workflows/new">
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Workflow
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search workflows..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Workflow Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : filteredWorkflows.length === 0 ? (
                    <div className="text-center py-20">
                        <Workflow className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {searchQuery ? 'No workflows found' : 'No workflows yet'}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            {searchQuery 
                                ? 'Try a different search term' 
                                : 'Create your first workflow to automate tasks'}
                        </p>
                        <Link href="/workstation/workflows/new">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Workflow
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredWorkflows.map((workflow) => {
                            const CategoryIcon = CATEGORY_ICONS[workflow.category] || Zap;
                            const isSystem = workflow.userId === 'system';
                            const isRunning = runningWorkflow === workflow.id;
                            
                            return (
                                <div
                                    key={workflow.id}
                                    className="bg-white rounded-xl border hover:shadow-lg transition-shadow"
                                >
                                    {/* Header */}
                                    <div 
                                        className="p-4 border-b"
                                        style={{ 
                                            background: `linear-gradient(135deg, ${workflow.color}10, ${workflow.color}05)` 
                                        }}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div 
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: workflow.color + '20' }}
                                                >
                                                    <CategoryIcon 
                                                        className="w-5 h-5" 
                                                        style={{ color: workflow.color }} 
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                        {workflow.name}
                                                        {isSystem && (
                                                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                        )}
                                                    </h3>
                                                    <span className="text-xs text-gray-500">
                                                        {workflow.steps.length} steps • {workflow.mode}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {workflow.isPublic && (
                                                    <Globe className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4">
                                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                            {workflow.description || 'No description'}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                            <span className="flex items-center gap-1">
                                                <Play className="w-3 h-3" />
                                                {workflow.runCount} runs
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDuration(workflow.avgDurationMs)}
                                            </span>
                                            <span className={`flex items-center gap-1 ${
                                                workflow.successRate >= 90 ? 'text-green-600' :
                                                workflow.successRate >= 70 ? 'text-yellow-600' :
                                                'text-red-600'
                                            }`}>
                                                {workflow.successRate >= 90 ? (
                                                    <CheckCircle className="w-3 h-3" />
                                                ) : (
                                                    <AlertCircle className="w-3 h-3" />
                                                )}
                                                {workflow.successRate.toFixed(0)}%
                                            </span>
                                        </div>

                                        {/* Tags */}
                                        {workflow.tags && workflow.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {workflow.tags.slice(0, 3).map((tag, i) => (
                                                    <span 
                                                        key={i}
                                                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => runWorkflow(workflow.id)}
                                                disabled={isRunning}
                                                className="flex-1"
                                            >
                                                {isRunning ? (
                                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4 mr-1" />
                                                )}
                                                {isRunning ? 'Running...' : 'Run'}
                                            </Button>
                                            <Link href={`/workstation/workflows/${workflow.id}`}>
                                                <Button variant="outline" size="sm">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onClick={() => duplicateWorkflow(workflow)}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                            {!isSystem && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => deleteWorkflow(workflow.id)}
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
