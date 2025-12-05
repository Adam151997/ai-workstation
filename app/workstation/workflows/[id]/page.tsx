// app/workstation/workflows/[id]/page.tsx
// Edit workflow page
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
    Workflow,
    ChevronLeft,
    Plus,
    Trash2,
    GripVertical,
    MessageSquare,
    Wrench,
    GitBranch,
    Timer,
    Globe,
    Save,
    Play,
    Loader2,
    ChevronDown,
    ChevronUp,
    Settings,
    History,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WorkflowStep {
    id: string;
    type: 'ai_prompt' | 'tool_call' | 'condition' | 'delay' | 'webhook';
    name: string;
    config: Record<string, any>;
    connections: string[];
    expanded?: boolean;
}

interface WorkflowTemplate {
    id: string;
    userId: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
    steps: WorkflowStep[];
    inputSchema: Record<string, any>;
    variables: Record<string, any>;
    isActive: boolean;
    isPublic: boolean;
    mode: string;
    icon: string;
    color: string;
    tags: string[];
    runCount: number;
    successRate: number;
}

const STEP_TYPES = [
    { type: 'ai_prompt', label: 'AI Prompt', icon: MessageSquare, color: '#8B5CF6', description: 'Generate text with AI' },
    { type: 'tool_call', label: 'Tool Call', icon: Wrench, color: '#F59E0B', description: 'Execute an MCP tool' },
    { type: 'condition', label: 'Condition', icon: GitBranch, color: '#10B981', description: 'Branch based on condition' },
    { type: 'delay', label: 'Delay', icon: Timer, color: '#6366F1', description: 'Wait for a duration' },
    { type: 'webhook', label: 'Webhook', icon: Globe, color: '#EC4899', description: 'Call external API' },
];

const CATEGORIES = [
    { value: 'custom', label: 'Custom' },
    { value: 'research', label: 'Research' },
    { value: 'content', label: 'Content' },
    { value: 'data', label: 'Data Processing' },
];

const MODES = [
    { value: 'Sales', label: 'Sales' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Admin', label: 'Admin' },
];

export default function EditWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false);
    
    // Workflow data
    const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('custom');
    const [mode, setMode] = useState('Sales');
    const [color, setColor] = useState('#3B82F6');
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    const [showStepPicker, setShowStepPicker] = useState(false);
    const [inputDialog, setInputDialog] = useState(false);
    const [runInputs, setRunInputs] = useState<Record<string, string>>({});

    useEffect(() => {
        loadWorkflow();
    }, [resolvedParams.id]);

    const loadWorkflow = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/workflows/${resolvedParams.id}`);
            const data = await res.json();
            
            if (data.success) {
                const w = data.workflow;
                setWorkflow(w);
                setName(w.name);
                setDescription(w.description || '');
                setCategory(w.category);
                setMode(w.mode);
                setColor(w.color);
                setSteps(w.steps.map((s: any) => ({ ...s, expanded: false })));
                setIsReadOnly(w.userId === 'system');
            } else {
                setError(data.error || 'Failed to load workflow');
            }
        } catch (err) {
            setError('Failed to load workflow');
        } finally {
            setLoading(false);
        }
    };

    const addStep = (type: string) => {
        const stepType = STEP_TYPES.find(s => s.type === type);
        
        setSteps(prev => {
            const newStep: WorkflowStep = {
                id: `step-${Date.now()}`,
                type: type as any,
                name: `${stepType?.label || 'Step'} ${prev.length + 1}`,
                config: getDefaultConfig(type),
                connections: [],
                expanded: true,
            };
            
            if (prev.length > 0) {
                const updated = [...prev];
                updated[updated.length - 1].connections = [newStep.id];
                return [...updated, newStep];
            } else {
                return [newStep];
            }
        });
        
        setShowStepPicker(false);
    };

    const getDefaultConfig = (type: string): Record<string, any> => {
        switch (type) {
            case 'ai_prompt':
                return { prompt: '', model: 'llama-3.3-70b-versatile', maxTokens: 2000 };
            case 'tool_call':
                return { tool: '', params: {} };
            case 'condition':
                return { condition: '' };
            case 'delay':
                return { delay: 1000 };
            case 'webhook':
                return { url: '', method: 'GET' };
            default:
                return {};
        }
    };

    const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
        setSteps(prev => prev.map(s => 
            s.id === id ? { ...s, ...updates } : s
        ));
    };

    const removeStep = (id: string) => {
        setSteps(prev => {
            const index = prev.findIndex(s => s.id === id);
            const updated = prev.filter(s => s.id !== id);
            
            if (index > 0 && index < prev.length - 1) {
                updated[index - 1].connections = [prev[index + 1].id];
            } else if (index > 0) {
                updated[index - 1].connections = [];
            }
            
            return updated;
        });
    };

    const moveStep = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= steps.length) return;
        
        setSteps(prev => {
            const updated = [...prev];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);
            
            for (let i = 0; i < updated.length; i++) {
                updated[i].connections = i < updated.length - 1 ? [updated[i + 1].id] : [];
            }
            
            return updated;
        });
    };

    const saveWorkflow = async () => {
        if (isReadOnly) {
            alert('Cannot edit system templates. Duplicate to create your own version.');
            return;
        }
        
        try {
            setSaving(true);
            
            const res = await fetch(`/api/workflows/${resolvedParams.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    category,
                    mode,
                    color,
                    steps: steps.map(({ expanded, ...s }) => s),
                }),
            });
            
            const data = await res.json();
            
            if (data.success) {
                alert('Workflow saved successfully!');
            } else {
                alert(`Failed to save: ${data.error}`);
            }
        } catch (error) {
            alert('Failed to save workflow');
        } finally {
            setSaving(false);
        }
    };

    const runWorkflow = async () => {
        // Check if workflow needs inputs
        const inputSchema = workflow?.inputSchema || {};
        const requiredInputs = Object.entries(inputSchema).filter(([_, v]: [string, any]) => v.required);
        
        if (requiredInputs.length > 0) {
            setInputDialog(true);
            return;
        }
        
        await executeWorkflow({});
    };

    const executeWorkflow = async (inputs: Record<string, any>) => {
        try {
            setRunning(true);
            setInputDialog(false);
            
            const res = await fetch(`/api/workflows/${resolvedParams.id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs }),
            });
            
            const data = await res.json();
            
            if (data.success) {
                alert(`✅ Workflow completed!\n\nDuration: ${data.durationMs}ms\nSteps: ${Object.keys(data.stepResults).length}`);
            } else {
                alert(`❌ Workflow failed:\n${data.error?.message || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to run workflow');
        } finally {
            setRunning(false);
        }
    };

    const renderStepConfig = (step: WorkflowStep) => {
        switch (step.type) {
            case 'ai_prompt':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                            <textarea
                                value={step.config.prompt || ''}
                                onChange={(e) => updateStep(step.id, { config: { ...step.config, prompt: e.target.value }})}
                                rows={4}
                                disabled={isReadOnly}
                                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                                <select
                                    value={step.config.model || 'llama-3.3-70b-versatile'}
                                    onChange={(e) => updateStep(step.id, { config: { ...step.config, model: e.target.value }})}
                                    disabled={isReadOnly}
                                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
                                >
                                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                                    <option value="gpt-4o">GPT-4o</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
                                <input
                                    type="number"
                                    value={step.config.maxTokens || 2000}
                                    onChange={(e) => updateStep(step.id, { config: { ...step.config, maxTokens: parseInt(e.target.value) }})}
                                    disabled={isReadOnly}
                                    className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'tool_call':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name</label>
                            <input
                                type="text"
                                value={step.config.tool || ''}
                                onChange={(e) => updateStep(step.id, { config: { ...step.config, tool: e.target.value }})}
                                disabled={isReadOnly}
                                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
                            />
                        </div>
                    </div>
                );

            case 'delay':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delay (ms)</label>
                        <input
                            type="number"
                            value={step.config.delay || 1000}
                            onChange={(e) => updateStep(step.id, { config: { ...step.config, delay: parseInt(e.target.value) }})}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
                        />
                    </div>
                );

            default:
                return <p className="text-sm text-gray-500">Configure this step type</p>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Link href="/workstation/workflows">
                        <Button>Back to Workflows</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/workstation/workflows" className="text-gray-600 hover:text-gray-900">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-2">
                                <Workflow className="w-6 h-6" style={{ color }} />
                                <h1 className="text-xl font-semibold text-gray-900">{name}</h1>
                                {isReadOnly && (
                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                        Read Only
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                {workflow?.runCount || 0} runs • {workflow?.successRate?.toFixed(0) || 100}% success
                            </div>
                            <Button variant="outline" onClick={runWorkflow} disabled={running}>
                                {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Run
                            </Button>
                            {!isReadOnly && (
                                <Button onClick={saveWorkflow} disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Save
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="col-span-2 space-y-6">
                        {/* Settings */}
                        <div className="bg-white rounded-xl border p-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Workflow Details
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        disabled={isReadOnly}
                                        rows={2}
                                        className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            disabled={isReadOnly}
                                            className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                                        <select
                                            value={mode}
                                            onChange={(e) => setMode(e.target.value)}
                                            disabled={isReadOnly}
                                            className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                                        >
                                            {MODES.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            disabled={isReadOnly}
                                            className="w-full h-10 border rounded-lg cursor-pointer disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold">Steps ({steps.length})</h2>
                            
                            {steps.map((step, index) => {
                                const stepType = STEP_TYPES.find(s => s.type === step.type);
                                const StepIcon = stepType?.icon || Workflow;
                                
                                return (
                                    <div key={step.id} className="bg-white rounded-xl border">
                                        <div 
                                            className="p-4 flex items-center gap-3 cursor-pointer"
                                            onClick={() => updateStep(step.id, { expanded: !step.expanded })}
                                        >
                                            {!isReadOnly && <GripVertical className="w-4 h-4 text-gray-400" />}
                                            <div 
                                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: stepType?.color + '20' }}
                                            >
                                                <StepIcon className="w-4 h-4" style={{ color: stepType?.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">{step.name}</div>
                                                <span className="text-xs text-gray-500">{stepType?.label}</span>
                                            </div>
                                            {!isReadOnly && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); moveStep(index, index - 1); }}
                                                        disabled={index === 0}
                                                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                    >
                                                        <ChevronUp className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); moveStep(index, index + 1); }}
                                                        disabled={index === steps.length - 1}
                                                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                                                        className="p-1 hover:bg-red-100 rounded text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            {step.expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                        </div>
                                        
                                        {step.expanded && (
                                            <div className="px-4 pb-4 pt-0 border-t bg-gray-50">
                                                <div className="pt-4">
                                                    {renderStepConfig(step)}
                                                </div>
                                            </div>
                                        )}

                                        {index < steps.length - 1 && (
                                            <div className="flex justify-center py-2">
                                                <div className="w-0.5 h-6 bg-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {!isReadOnly && (
                                <div className="relative">
                                    <Button variant="outline" className="w-full" onClick={() => setShowStepPicker(!showStepPicker)}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Step
                                    </Button>
                                    
                                    {showStepPicker && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border shadow-lg p-2 z-10">
                                            <div className="grid grid-cols-2 gap-2">
                                                {STEP_TYPES.map(type => (
                                                    <button
                                                        key={type.type}
                                                        onClick={() => addStep(type.type)}
                                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                                                    >
                                                        <div 
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                            style={{ backgroundColor: type.color + '20' }}
                                                        >
                                                            <type.icon className="w-5 h-5" style={{ color: type.color }} />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">{type.label}</div>
                                                            <div className="text-xs text-gray-500">{type.description}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border p-4 sticky top-24">
                            <h3 className="font-semibold mb-3">Workflow Info</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">ID</span>
                                    <span className="font-mono text-xs">{resolvedParams.id.slice(0, 8)}...</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Steps</span>
                                    <span>{steps.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Total Runs</span>
                                    <span>{workflow?.runCount || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Success Rate</span>
                                    <span>{workflow?.successRate?.toFixed(0) || 100}%</span>
                                </div>
                            </div>
                        </div>

                        {isReadOnly && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <h3 className="font-semibold text-yellow-900 mb-2">📋 System Template</h3>
                                <p className="text-sm text-yellow-800">
                                    This is a system template and cannot be edited. Use the "Duplicate" button from the workflows list to create your own editable copy.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Input Dialog */}
            {inputDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Workflow Inputs</h3>
                        <div className="space-y-4">
                            {Object.entries(workflow?.inputSchema || {}).map(([key, schema]: [string, any]) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {key} {schema.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={runInputs[key] || ''}
                                        onChange={(e) => setRunInputs({ ...runInputs, [key]: e.target.value })}
                                        placeholder={schema.description || `Enter ${key}`}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setInputDialog(false)}>Cancel</Button>
                            <Button onClick={() => executeWorkflow(runInputs)}>
                                <Play className="w-4 h-4 mr-2" />
                                Run Workflow
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
