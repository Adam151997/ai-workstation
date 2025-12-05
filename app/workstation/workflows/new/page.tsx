// app/workstation/workflows/new/page.tsx
// Create new workflow page
'use client';

import { useState } from 'react';
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
    Settings
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

export default function NewWorkflowPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    
    // Workflow metadata
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('custom');
    const [mode, setMode] = useState('Sales');
    const [color, setColor] = useState('#3B82F6');
    
    // Steps
    const [steps, setSteps] = useState<WorkflowStep[]>([]);
    const [showStepPicker, setShowStepPicker] = useState(false);

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
                return { condition: '', trueBranch: '', falseBranch: '' };
            case 'delay':
                return { delay: 1000 };
            case 'webhook':
                return { url: '', method: 'GET', headers: {}, body: '' };
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
            
            // Update connections
            if (index > 0 && index < prev.length - 1) {
                // Connect previous to next
                updated[index - 1].connections = [prev[index + 1].id];
            } else if (index > 0) {
                // Remove connection from previous
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
            
            // Rebuild connections
            for (let i = 0; i < updated.length; i++) {
                updated[i].connections = i < updated.length - 1 ? [updated[i + 1].id] : [];
            }
            
            return updated;
        });
    };

    const saveWorkflow = async () => {
        if (!name.trim()) {
            alert('Please enter a workflow name');
            return;
        }
        
        if (steps.length === 0) {
            alert('Please add at least one step');
            return;
        }
        
        try {
            setSaving(true);
            
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    category,
                    mode,
                    color,
                    steps: steps.map(({ expanded, ...s }) => s),
                    tags: [],
                }),
            });
            
            const data = await res.json();
            
            if (data.success) {
                router.push('/workstation/workflows');
            } else {
                alert(`Failed to save: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to save workflow:', error);
            alert('Failed to save workflow');
        } finally {
            setSaving(false);
        }
    };

    const testWorkflow = async () => {
        if (steps.length === 0) {
            alert('Please add at least one step to test');
            return;
        }
        
        // For now, just show the steps
        alert(`Would test workflow with ${steps.length} steps:\n\n${steps.map((s, i) => `${i + 1}. ${s.name} (${s.type})`).join('\n')}`);
    };

    const renderStepConfig = (step: WorkflowStep) => {
        switch (step.type) {
            case 'ai_prompt':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prompt
                            </label>
                            <textarea
                                value={step.config.prompt || ''}
                                onChange={(e) => updateStep(step.id, { 
                                    config: { ...step.config, prompt: e.target.value }
                                })}
                                rows={4}
                                placeholder="Enter your prompt... Use {{variable}} for inputs"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Use {'{{variable}}'} for inputs, {'{{step_N_output}}'} for previous step outputs
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Model
                                </label>
                                <select
                                    value={step.config.model || 'llama-3.3-70b-versatile'}
                                    onChange={(e) => updateStep(step.id, {
                                        config: { ...step.config, model: e.target.value }
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                                    <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                                    <option value="gpt-4o">GPT-4o</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Tokens
                                </label>
                                <input
                                    type="number"
                                    value={step.config.maxTokens || 2000}
                                    onChange={(e) => updateStep(step.id, {
                                        config: { ...step.config, maxTokens: parseInt(e.target.value) }
                                    })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'tool_call':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tool Name
                            </label>
                            <input
                                type="text"
                                value={step.config.tool || ''}
                                onChange={(e) => updateStep(step.id, {
                                    config: { ...step.config, tool: e.target.value }
                                })}
                                placeholder="e.g., tavily_search, rag_search"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Parameters (JSON)
                            </label>
                            <textarea
                                value={JSON.stringify(step.config.params || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const params = JSON.parse(e.target.value);
                                        updateStep(step.id, {
                                            config: { ...step.config, params }
                                        });
                                    } catch {}
                                }}
                                rows={3}
                                placeholder='{"query": "{{topic}}"}'
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                            />
                        </div>
                    </div>
                );

            case 'delay':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delay (milliseconds)
                        </label>
                        <input
                            type="number"
                            value={step.config.delay || 1000}
                            onChange={(e) => updateStep(step.id, {
                                config: { ...step.config, delay: parseInt(e.target.value) }
                            })}
                            min={100}
                            max={10000}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                );

            case 'condition':
                return (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Condition (JavaScript expression)
                        </label>
                        <input
                            type="text"
                            value={step.config.condition || ''}
                            onChange={(e) => updateStep(step.id, {
                                config: { ...step.config, condition: e.target.value }
                            })}
                            placeholder="e.g., step_1_output.length > 100"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                );

            case 'webhook':
                return (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL
                            </label>
                            <input
                                type="url"
                                value={step.config.url || ''}
                                onChange={(e) => updateStep(step.id, {
                                    config: { ...step.config, url: e.target.value }
                                })}
                                placeholder="https://api.example.com/webhook"
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Method
                            </label>
                            <select
                                value={step.config.method || 'GET'}
                                onChange={(e) => updateStep(step.id, {
                                    config: { ...step.config, method: e.target.value }
                                })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link 
                                href="/workstation/workflows"
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-2">
                                <Workflow className="w-6 h-6 text-blue-600" />
                                <h1 className="text-xl font-semibold text-gray-900">New Workflow</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" onClick={testWorkflow} disabled={testing}>
                                <Play className="w-4 h-4 mr-2" />
                                Test
                            </Button>
                            <Button onClick={saveWorkflow} disabled={saving}>
                                {saving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Workflow
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid grid-cols-3 gap-8">
                    {/* Main Content - Steps */}
                    <div className="col-span-2 space-y-6">
                        {/* Metadata Card */}
                        <div className="bg-white rounded-xl border p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Workflow Details
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="My Awesome Workflow"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={2}
                                        placeholder="What does this workflow do?"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            {CATEGORIES.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Mode
                                        </label>
                                        <select
                                            value={mode}
                                            onChange={(e) => setMode(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                            {MODES.map(m => (
                                                <option key={m.value} value={m.value}>{m.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Color
                                        </label>
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="w-full h-10 border rounded-lg cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">Steps</h2>
                            
                            {steps.length === 0 ? (
                                <div className="bg-white rounded-xl border border-dashed p-8 text-center">
                                    <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-600 mb-4">No steps yet. Add your first step to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {steps.map((step, index) => {
                                        const stepType = STEP_TYPES.find(s => s.type === step.type);
                                        const StepIcon = stepType?.icon || Workflow;
                                        
                                        return (
                                            <div 
                                                key={step.id}
                                                className="bg-white rounded-xl border"
                                            >
                                                {/* Step Header */}
                                                <div 
                                                    className="p-4 flex items-center gap-3 cursor-pointer"
                                                    onClick={() => updateStep(step.id, { expanded: !step.expanded })}
                                                >
                                                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                                    <div 
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                        style={{ backgroundColor: stepType?.color + '20' }}
                                                    >
                                                        <StepIcon 
                                                            className="w-4 h-4"
                                                            style={{ color: stepType?.color }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            value={step.name}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                updateStep(step.id, { name: e.target.value });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="font-medium bg-transparent border-none focus:ring-0 p-0"
                                                        />
                                                        <span className="text-xs text-gray-500">{stepType?.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                moveStep(index, index - 1);
                                                            }}
                                                            disabled={index === 0}
                                                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                        >
                                                            <ChevronUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                moveStep(index, index + 1);
                                                            }}
                                                            disabled={index === steps.length - 1}
                                                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                                        >
                                                            <ChevronDown className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeStep(step.id);
                                                            }}
                                                            className="p-1 hover:bg-red-100 rounded text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                        {step.expanded ? (
                                                            <ChevronUp className="w-4 h-4 text-gray-400" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Step Config */}
                                                {step.expanded && (
                                                    <div className="px-4 pb-4 pt-0 border-t bg-gray-50">
                                                        <div className="pt-4">
                                                            {renderStepConfig(step)}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Connection Line */}
                                                {index < steps.length - 1 && (
                                                    <div className="flex justify-center py-2">
                                                        <div className="w-0.5 h-6 bg-gray-300" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Add Step Button */}
                            <div className="relative">
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={() => setShowStepPicker(!showStepPicker)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Step
                                </Button>
                                
                                {/* Step Type Picker */}
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
                                                        <type.icon 
                                                            className="w-5 h-5" 
                                                            style={{ color: type.color }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{type.label}</div>
                                                        <div className="text-xs text-gray-500">{type.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Preview & Help */}
                    <div className="space-y-6">
                        {/* Preview Card */}
                        <div className="bg-white rounded-xl border p-4 sticky top-24">
                            <h3 className="font-semibold text-gray-900 mb-3">Preview</h3>
                            <div 
                                className="p-4 rounded-lg"
                                style={{ backgroundColor: color + '10' }}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div 
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: color + '20' }}
                                    >
                                        <Workflow className="w-5 h-5" style={{ color }} />
                                    </div>
                                    <div>
                                        <div className="font-semibold">{name || 'Untitled'}</div>
                                        <div className="text-xs text-gray-500">
                                            {steps.length} steps • {mode}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {description || 'No description'}
                                </p>
                            </div>
                        </div>

                        {/* Help */}
                        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                            <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
                            <ul className="text-sm text-blue-800 space-y-2">
                                <li>• Use {'{{variable}}'} syntax for dynamic inputs</li>
                                <li>• Reference previous outputs with {'{{step_N_output}}'}</li>
                                <li>• Steps execute in order from top to bottom</li>
                                <li>• Test your workflow before saving</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
