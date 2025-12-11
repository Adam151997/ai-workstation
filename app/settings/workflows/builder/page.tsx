// app/settings/workflows/builder/page.tsx
// Visual Workflow Builder - Drag and Drop interface (Databricks Model)
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Workflow,
    Save,
    Play,
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    BookOpen,
    Clock,
    Zap,
    Globe,
    Mail,
    Database,
    Filter,
    GitBranch,
    MessageSquare,
    Code,
    FileText,
    Loader2,
    ChevronDown,
    ChevronUp,
    Settings,
    AlertTriangle,
    CheckCircle,
    ArrowDown,
    X
} from 'lucide-react';

// Node Types
type NodeType = 
    | 'NOTEBOOK_EXECUTION'
    | 'CONDITION'
    | 'DELAY'
    | 'WEBHOOK'
    | 'EMAIL'
    | 'AI_PROMPT'
    | 'DATA_QUERY'
    | 'TRANSFORM'
    | 'NOTIFICATION';

interface WorkflowNode {
    id: string;
    type: NodeType;
    name: string;
    config: Record<string, any>;
    position: number;
}

interface Notebook {
    id: string;
    title: string;
    cellCount: number;
}

const NODE_TYPES: Record<NodeType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
    NOTEBOOK_EXECUTION: {
        label: 'Execute Notebook',
        icon: <BookOpen className="w-5 h-5" />,
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        description: 'Run all cells in a notebook sequentially',
    },
    CONDITION: {
        label: 'Condition',
        icon: <GitBranch className="w-5 h-5" />,
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        description: 'Branch based on a condition',
    },
    DELAY: {
        label: 'Delay',
        icon: <Clock className="w-5 h-5" />,
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        description: 'Wait for a specified duration',
    },
    WEBHOOK: {
        label: 'Webhook',
        icon: <Globe className="w-5 h-5" />,
        color: 'bg-green-100 text-green-700 border-green-300',
        description: 'Call an external HTTP endpoint',
    },
    EMAIL: {
        label: 'Send Email',
        icon: <Mail className="w-5 h-5" />,
        color: 'bg-red-100 text-red-700 border-red-300',
        description: 'Send an email notification',
    },
    AI_PROMPT: {
        label: 'AI Prompt',
        icon: <MessageSquare className="w-5 h-5" />,
        color: 'bg-indigo-100 text-indigo-700 border-indigo-300',
        description: 'Run an AI prompt with context',
    },
    DATA_QUERY: {
        label: 'Data Query',
        icon: <Database className="w-5 h-5" />,
        color: 'bg-cyan-100 text-cyan-700 border-cyan-300',
        description: 'Query documents or data sources',
    },
    TRANSFORM: {
        label: 'Transform',
        icon: <Code className="w-5 h-5" />,
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        description: 'Transform data with code',
    },
    NOTIFICATION: {
        label: 'Notification',
        icon: <Zap className="w-5 h-5" />,
        color: 'bg-pink-100 text-pink-700 border-pink-300',
        description: 'Send a notification',
    },
};

function WorkflowBuilderContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const workflowId = searchParams.get('id');

    const [workflow, setWorkflow] = useState<{
        id: string;
        name: string;
        description: string;
        triggerType: string;
        triggerConfig: Record<string, any>;
        mode: string;
    } | null>(null);
    const [nodes, setNodes] = useState<WorkflowNode[]>([]);
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [showNodePicker, setShowNodePicker] = useState(false);
    const [draggedNode, setDraggedNode] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Load workflow and notebooks
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Load notebooks for the picker
                const notebooksRes = await fetch('/api/notebooks');
                const notebooksData = await notebooksRes.json();
                if (notebooksData.success) {
                    setNotebooks(notebooksData.notebooks || []);
                }

                // Load existing workflow if editing
                if (workflowId) {
                    const workflowRes = await fetch(`/api/workflows/${workflowId}`);
                    const workflowData = await workflowRes.json();
                    if (workflowData.success) {
                        setWorkflow({
                            id: workflowData.template.id,
                            name: workflowData.template.name,
                            description: workflowData.template.description,
                            triggerType: workflowData.template.triggerType,
                            triggerConfig: workflowData.template.triggerConfig || {},
                            mode: workflowData.template.mode,
                        });
                        // Convert steps to nodes
                        const loadedNodes: WorkflowNode[] = (workflowData.template.steps || []).map((step: any, idx: number) => ({
                            id: step.id || `node-${idx}`,
                            type: step.type || 'AI_PROMPT',
                            name: step.name || `Step ${idx + 1}`,
                            config: step.config || {},
                            position: idx,
                        }));
                        setNodes(loadedNodes);
                    }
                } else {
                    // New workflow
                    setWorkflow({
                        id: '',
                        name: 'New Workflow',
                        description: '',
                        triggerType: 'manual',
                        triggerConfig: {},
                        mode: 'Sales',
                    });
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [workflowId]);

    const addNode = (type: NodeType) => {
        const newNode: WorkflowNode = {
            id: `node-${Date.now()}`,
            type,
            name: NODE_TYPES[type].label,
            config: {},
            position: nodes.length,
        };
        setNodes([...nodes, newNode]);
        setShowNodePicker(false);
        setSelectedNode(newNode.id);
        setHasChanges(true);
    };

    const removeNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId).map((n, idx) => ({ ...n, position: idx })));
        if (selectedNode === nodeId) setSelectedNode(null);
        setHasChanges(true);
    };

    const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
        setNodes(nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n));
        setHasChanges(true);
    };

    const updateNodeName = (nodeId: string, name: string) => {
        setNodes(nodes.map(n => n.id === nodeId ? { ...n, name } : n));
        setHasChanges(true);
    };

    const moveNode = (fromIndex: number, toIndex: number) => {
        const newNodes = [...nodes];
        const [movedNode] = newNodes.splice(fromIndex, 1);
        newNodes.splice(toIndex, 0, movedNode);
        setNodes(newNodes.map((n, idx) => ({ ...n, position: idx })));
        setHasChanges(true);
    };

    const saveWorkflow = async () => {
        if (!workflow) return;

        try {
            setSaving(true);
            const steps = nodes.map(n => ({
                id: n.id,
                type: n.type,
                name: n.name,
                config: n.config,
            }));

            const endpoint = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows';
            const method = workflowId ? 'PATCH' : 'POST';

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: workflow.name,
                    description: workflow.description,
                    triggerType: workflow.triggerType,
                    triggerConfig: workflow.triggerConfig,
                    mode: workflow.mode,
                    steps,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setHasChanges(false);
                if (!workflowId && data.id) {
                    router.replace(`/settings/workflows/builder?id=${data.id}`);
                }
            } else {
                alert(data.error || 'Failed to save workflow');
            }
        } catch (error) {
            console.error('Failed to save workflow:', error);
        } finally {
            setSaving(false);
        }
    };

    const runWorkflow = async () => {
        if (!workflowId) {
            alert('Please save the workflow first');
            return;
        }

        try {
            const res = await fetch(`/api/workflows/${workflowId}/run`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Workflow started! Check Background Jobs for progress.');
            } else {
                alert(data.error || 'Failed to run workflow');
            }
        } catch (error) {
            console.error('Failed to run workflow:', error);
        }
    };

    const selectedNodeData = nodes.find(n => n.id === selectedNode);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.push('/settings/workflows')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div className="flex items-center gap-2">
                        <Workflow className="w-5 h-5 text-purple-600" />
                        <input
                            type="text"
                            value={workflow?.name || ''}
                            onChange={(e) => {
                                if (workflow) {
                                    setWorkflow({ ...workflow, name: e.target.value });
                                    setHasChanges(true);
                                }
                            }}
                            className="text-lg font-semibold border-none focus:ring-0 focus:outline-none bg-transparent"
                            placeholder="Workflow Name"
                        />
                        {hasChanges && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                Unsaved
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={runWorkflow} disabled={!workflowId || nodes.length === 0}>
                        <Play className="w-4 h-4 mr-2" />
                        Run
                    </Button>
                    <Button onClick={saveWorkflow} disabled={saving}>
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 bg-gray-50 p-6 overflow-auto">
                    {/* Trigger */}
                    <div className="mb-4">
                        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg p-4 shadow-lg max-w-md">
                            <div className="flex items-center gap-3">
                                <Zap className="w-6 h-6" />
                                <div>
                                    <div className="font-semibold">Trigger: {workflow?.triggerType || 'Manual'}</div>
                                    <div className="text-sm text-purple-100">
                                        {workflow?.triggerType === 'manual' && 'Run manually from dashboard'}
                                        {workflow?.triggerType === 'schedule' && 'Run on a schedule'}
                                        {workflow?.triggerType === 'webhook' && 'Triggered by webhook'}
                                        {workflow?.triggerType === 'event' && 'Triggered by event'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nodes */}
                    <div className="space-y-3 max-w-md">
                        {nodes.map((node, index) => (
                            <div key={node.id}>
                                {/* Connector */}
                                {index > 0 && (
                                    <div className="flex justify-center py-2">
                                        <ArrowDown className="w-5 h-5 text-gray-400" />
                                    </div>
                                )}
                                {index === 0 && (
                                    <div className="flex justify-center py-2">
                                        <ArrowDown className="w-5 h-5 text-gray-400" />
                                    </div>
                                )}

                                {/* Node Card */}
                                <div
                                    className={`bg-white rounded-lg border-2 p-4 shadow-sm cursor-pointer transition-all ${
                                        selectedNode === node.id 
                                            ? 'border-purple-500 ring-2 ring-purple-200' 
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => setSelectedNode(node.id)}
                                    draggable
                                    onDragStart={() => setDraggedNode(node.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                        if (draggedNode && draggedNode !== node.id) {
                                            const fromIndex = nodes.findIndex(n => n.id === draggedNode);
                                            const toIndex = nodes.findIndex(n => n.id === node.id);
                                            moveNode(fromIndex, toIndex);
                                        }
                                        setDraggedNode(null);
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                        <div className={`p-2 rounded-lg ${NODE_TYPES[node.type].color}`}>
                                            {NODE_TYPES[node.type].icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900">{node.name}</div>
                                            <div className="text-xs text-gray-500">{NODE_TYPES[node.type].label}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeNode(node.id);
                                            }}
                                            className="text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Config Preview */}
                                    {node.type === 'NOTEBOOK_EXECUTION' && node.config.notebookId && (
                                        <div className="mt-2 text-xs text-gray-500 bg-orange-50 rounded px-2 py-1">
                                            📓 {notebooks.find(n => n.id === node.config.notebookId)?.title || 'Unknown Notebook'}
                                        </div>
                                    )}
                                    {node.type === 'DELAY' && node.config.duration && (
                                        <div className="mt-2 text-xs text-gray-500 bg-blue-50 rounded px-2 py-1">
                                            ⏱️ Wait {node.config.duration} {node.config.unit || 'seconds'}
                                        </div>
                                    )}
                                    {node.type === 'CONDITION' && node.config.condition && (
                                        <div className="mt-2 text-xs text-gray-500 bg-purple-50 rounded px-2 py-1">
                                            🔀 {node.config.condition}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Add Node Button */}
                        <div className="flex justify-center py-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowNodePicker(true)}
                                className="border-dashed border-2"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Step
                            </Button>
                        </div>
                    </div>

                    {/* Empty State */}
                    {nodes.length === 0 && (
                        <div className="text-center py-12">
                            <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No steps yet</h3>
                            <p className="text-gray-600 mb-4">Add your first step to build the workflow</p>
                            <Button onClick={() => setShowNodePicker(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Step
                            </Button>
                        </div>
                    )}
                </div>

                {/* Properties Panel */}
                <div className="w-96 bg-white border-l overflow-auto">
                    {selectedNodeData ? (
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">Node Settings</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedNode(null)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {/* Node Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={selectedNodeData.name}
                                        onChange={(e) => updateNodeName(selectedNodeData.id, e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                {/* Type-specific config */}
                                {selectedNodeData.type === 'NOTEBOOK_EXECUTION' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notebook</label>
                                        <select
                                            value={selectedNodeData.config.notebookId || ''}
                                            onChange={(e) => updateNodeConfig(selectedNodeData.id, { notebookId: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="">Select a notebook...</option>
                                            {notebooks.map(nb => (
                                                <option key={nb.id} value={nb.id}>{nb.title}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Executes all cells in the notebook sequentially
                                        </p>
                                    </div>
                                )}

                                {selectedNodeData.type === 'DELAY' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                                            <input
                                                type="number"
                                                value={selectedNodeData.config.duration || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { duration: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                                min={1}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                                            <select
                                                value={selectedNodeData.config.unit || 'seconds'}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { unit: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="seconds">Seconds</option>
                                                <option value="minutes">Minutes</option>
                                                <option value="hours">Hours</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {selectedNodeData.type === 'CONDITION' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                                        <input
                                            type="text"
                                            value={selectedNodeData.config.condition || ''}
                                            onChange={(e) => updateNodeConfig(selectedNodeData.id, { condition: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            placeholder="e.g., {{last_output}} > 0"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Use {'{{variable}}'} to reference workflow variables
                                        </p>
                                    </div>
                                )}

                                {selectedNodeData.type === 'WEBHOOK' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                                            <input
                                                type="url"
                                                value={selectedNodeData.config.url || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { url: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                                placeholder="https://..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                            <select
                                                value={selectedNodeData.config.method || 'POST'}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { method: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="GET">GET</option>
                                                <option value="POST">POST</option>
                                                <option value="PUT">PUT</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                {selectedNodeData.type === 'EMAIL' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                                            <input
                                                type="email"
                                                value={selectedNodeData.config.to || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { to: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                                placeholder="recipient@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                            <input
                                                type="text"
                                                value={selectedNodeData.config.subject || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { subject: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                                            <textarea
                                                value={selectedNodeData.config.body || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { body: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                                rows={4}
                                            />
                                        </div>
                                    </>
                                )}

                                {selectedNodeData.type === 'AI_PROMPT' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                                            <textarea
                                                value={selectedNodeData.config.prompt || ''}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { prompt: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                                rows={4}
                                                placeholder="Enter your prompt here..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                            <select
                                                value={selectedNodeData.config.model || 'gpt-4'}
                                                onChange={(e) => updateNodeConfig(selectedNodeData.id, { model: e.target.value })}
                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="gpt-4">GPT-4</option>
                                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                                <option value="llama3-70b">Llama 3 70B</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="text-center py-12">
                                <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500">Select a node to configure</p>
                            </div>

                            {/* Workflow Settings */}
                            <div className="mt-6 pt-6 border-t">
                                <h3 className="font-semibold text-gray-900 mb-4">Workflow Settings</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            value={workflow?.description || ''}
                                            onChange={(e) => {
                                                if (workflow) {
                                                    setWorkflow({ ...workflow, description: e.target.value });
                                                    setHasChanges(true);
                                                }
                                            }}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            rows={3}
                                            placeholder="What does this workflow do?"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                                        <select
                                            value={workflow?.triggerType || 'manual'}
                                            onChange={(e) => {
                                                if (workflow) {
                                                    setWorkflow({ ...workflow, triggerType: e.target.value });
                                                    setHasChanges(true);
                                                }
                                            }}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="manual">Manual</option>
                                            <option value="schedule">Schedule</option>
                                            <option value="webhook">Webhook</option>
                                            <option value="event">Event</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                                        <select
                                            value={workflow?.mode || 'Sales'}
                                            onChange={(e) => {
                                                if (workflow) {
                                                    setWorkflow({ ...workflow, mode: e.target.value });
                                                    setHasChanges(true);
                                                }
                                            }}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="Sales">Sales</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Node Picker Modal */}
            {showNodePicker && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add Step</h3>
                            <Button variant="ghost" size="sm" onClick={() => setShowNodePicker(false)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(NODE_TYPES).map(([type, config]) => (
                                <button
                                    key={type}
                                    onClick={() => addNode(type as NodeType)}
                                    className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${config.color}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {config.icon}
                                        <div>
                                            <div className="font-medium">{config.label}</div>
                                            <div className="text-xs opacity-75">{config.description}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function WorkflowBuilderPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        }>
            <WorkflowBuilderContent />
        </Suspense>
    );
}
