// app/settings/tools/page.tsx
// Installed Toolkits Management - Same card format as Toolkit Store
'use client';

import { useState, useEffect } from 'react';
import { 
    Search, Loader2, Plug, Check, ExternalLink, Settings2,
    ChevronDown, ChevronRight, Trash2, RefreshCw, Link2, Unlink,
    ToggleLeft, ToggleRight, AlertCircle, Star
} from 'lucide-react';

interface InstalledToolkit {
    id: string;
    toolkit_id: string;
    name: string;
    slug: string;
    description: string;
    icon_url: string;
    category: string;
    auth_type: string;
    status: 'pending' | 'connected' | 'error' | 'disabled';
    is_connected: boolean;
    connection_id?: string;
    enabled_actions: string[];
    disabled_actions: string[];
    usage_count: number;
    installed_at: string;
    error_message?: string;
}

interface ToolAction {
    name: string;
    description: string;
    enabled: boolean;
}

export default function ToolsSettingsPage() {
    const [toolkits, setToolkits] = useState<InstalledToolkit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedToolkit, setExpandedToolkit] = useState<string | null>(null);
    const [toolkitActions, setToolkitActions] = useState<Record<string, ToolAction[]>>({});
    const [loadingActions, setLoadingActions] = useState<string | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [uninstallingId, setUninstallingId] = useState<string | null>(null);

    // Fetch installed toolkits
    useEffect(() => {
        fetchToolkits();
    }, []);

    const fetchToolkits = async () => {
        try {
            const response = await fetch('/api/toolkits?view=installed');
            const data = await response.json();
            setToolkits(data.toolkits || []);
        } catch (error) {
            console.error('Failed to fetch toolkits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Connect toolkit (initiate OAuth)
    const connectToolkit = async (toolkitId: string) => {
        setConnectingId(toolkitId);
        try {
            const response = await fetch(`/api/toolkits/${toolkitId}/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    redirectUrl: `${window.location.origin}/settings/tools?connected=${toolkitId}` 
                }),
            });

            const data = await response.json();

            if (data.authUrl) {
                // Redirect to OAuth
                window.location.href = data.authUrl;
            } else if (data.success) {
                // No OAuth needed, refresh
                await fetchToolkits();
            }
        } catch (error) {
            console.error('Failed to connect toolkit:', error);
        } finally {
            setConnectingId(null);
        }
    };

    // Uninstall toolkit
    const uninstallToolkit = async (toolkitId: string) => {
        if (!confirm('Are you sure you want to uninstall this toolkit?')) return;

        setUninstallingId(toolkitId);
        try {
            await fetch(`/api/toolkits/${toolkitId}`, { method: 'DELETE' });
            setToolkits(prev => prev.filter(t => t.id !== toolkitId));
        } catch (error) {
            console.error('Failed to uninstall toolkit:', error);
        } finally {
            setUninstallingId(null);
        }
    };

    // Load actions for a toolkit
    const loadToolkitActions = async (toolkit: InstalledToolkit) => {
        if (toolkitActions[toolkit.id]) return;

        setLoadingActions(toolkit.id);
        try {
            // For now, simulate loading actions
            // In production, this would call Composio API
            const mockActions: ToolAction[] = [
                { name: `${toolkit.slug}_list`, description: `List ${toolkit.name} items`, enabled: true },
                { name: `${toolkit.slug}_create`, description: `Create new ${toolkit.name} item`, enabled: true },
                { name: `${toolkit.slug}_update`, description: `Update ${toolkit.name} item`, enabled: true },
                { name: `${toolkit.slug}_delete`, description: `Delete ${toolkit.name} item`, enabled: false },
                { name: `${toolkit.slug}_search`, description: `Search ${toolkit.name}`, enabled: true },
            ];

            // Apply user's enabled/disabled preferences
            const actionsWithPrefs = mockActions.map(action => ({
                ...action,
                enabled: toolkit.disabled_actions.includes(action.name) 
                    ? false 
                    : toolkit.enabled_actions.length === 0 || toolkit.enabled_actions.includes(action.name),
            }));

            setToolkitActions(prev => ({ ...prev, [toolkit.id]: actionsWithPrefs }));
        } catch (error) {
            console.error('Failed to load actions:', error);
        } finally {
            setLoadingActions(null);
        }
    };

    // Toggle action enabled/disabled
    const toggleAction = async (toolkitId: string, actionName: string) => {
        const actions = toolkitActions[toolkitId];
        if (!actions) return;

        const updatedActions = actions.map(a => 
            a.name === actionName ? { ...a, enabled: !a.enabled } : a
        );

        setToolkitActions(prev => ({ ...prev, [toolkitId]: updatedActions }));

        // Update in database
        const enabledActions = updatedActions.filter(a => a.enabled).map(a => a.name);
        const disabledActions = updatedActions.filter(a => !a.enabled).map(a => a.name);

        try {
            await fetch(`/api/toolkits/${toolkitId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledActions, disabledActions }),
            });
        } catch (error) {
            console.error('Failed to update actions:', error);
        }
    };

    // Expand/collapse toolkit
    const toggleExpand = (toolkit: InstalledToolkit) => {
        if (expandedToolkit === toolkit.id) {
            setExpandedToolkit(null);
        } else {
            setExpandedToolkit(toolkit.id);
            if (toolkit.is_connected) {
                loadToolkitActions(toolkit);
            }
        }
    };

    const filteredToolkits = toolkits.filter(t => 
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusConfig = (status: string, isConnected: boolean) => {
        if (isConnected) return { label: 'Connected', color: 'var(--success)', bg: 'var(--success-muted)' };
        switch (status) {
            case 'pending': return { label: 'Pending', color: 'var(--warning)', bg: 'var(--warning-muted)' };
            case 'error': return { label: 'Error', color: 'var(--error)', bg: 'var(--error-muted)' };
            case 'disabled': return { label: 'Disabled', color: 'var(--text-tertiary)', bg: 'var(--surface-secondary)' };
            default: return { label: 'Unknown', color: 'var(--text-tertiary)', bg: 'var(--surface-secondary)' };
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                    My Toolkits
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Manage your installed integrations and configure available actions
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border p-4" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Installed</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{toolkits.length}</p>
                </div>
                <div className="rounded-xl border p-4" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Connected</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>
                        {toolkits.filter(t => t.is_connected).length}
                    </p>
                </div>
                <div className="rounded-xl border p-4" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Pending</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
                        {toolkits.filter(t => t.status === 'pending').length}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                <input
                    type="text"
                    placeholder="Search installed toolkits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border font-display text-sm"
                    style={{ 
                        background: 'var(--surface-primary)', 
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                    }}
                />
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
            ) : filteredToolkits.length === 0 ? (
                <div className="text-center py-12 rounded-xl border" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                    <Plug className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: 'var(--text-tertiary)' }} />
                    <p className="font-display font-medium" style={{ color: 'var(--text-secondary)' }}>
                        No toolkits installed
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Visit the <a href="/settings/toolkit-store" className="underline" style={{ color: 'var(--accent-primary)' }}>Toolkit Store</a> to install integrations
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredToolkits.map((toolkit) => {
                        const statusConfig = getStatusConfig(toolkit.status, toolkit.is_connected);
                        const isExpanded = expandedToolkit === toolkit.id;
                        const actions = toolkitActions[toolkit.id] || [];

                        return (
                            <div 
                                key={toolkit.id}
                                className="rounded-xl border overflow-hidden"
                                style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
                            >
                                {/* Toolkit Card - Same format as Store */}
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Icon */}
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-secondary)' }}>
                                            {toolkit.icon_url ? (
                                                <img src={toolkit.icon_url} alt={toolkit.name} className="w-8 h-8 object-contain" />
                                            ) : (
                                                <Plug className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {toolkit.name}
                                                </h3>
                                                {/* Status Badge */}
                                                <span 
                                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                    style={{ background: statusConfig.bg, color: statusConfig.color }}
                                                >
                                                    {statusConfig.label}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                                {toolkit.description}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {!toolkit.is_connected && toolkit.status === 'pending' && (
                                                <button
                                                    onClick={() => connectToolkit(toolkit.id)}
                                                    disabled={connectingId === toolkit.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                                                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                                                >
                                                    {connectingId === toolkit.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Link2 className="w-4 h-4" />
                                                    )}
                                                    Connect
                                                </button>
                                            )}

                                            {toolkit.is_connected && (
                                                <button
                                                    onClick={() => toggleExpand(toolkit)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all hover:bg-[var(--surface-hover)]"
                                                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    Manage
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4" />
                                                    )}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => uninstallToolkit(toolkit.id)}
                                                disabled={uninstallingId === toolkit.id}
                                                className="p-1.5 rounded-lg transition-all hover:bg-red-100"
                                                title="Uninstall"
                                            >
                                                {uninstallingId === toolkit.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--error)' }} />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" style={{ color: 'var(--error)' }} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Footer Stats */}
                                    <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                                        <span>Installed {new Date(toolkit.installed_at).toLocaleDateString()}</span>
                                        {toolkit.usage_count > 0 && (
                                            <>
                                                <span>•</span>
                                                <span>Used {toolkit.usage_count} times</span>
                                            </>
                                        )}
                                        {toolkit.error_message && (
                                            <>
                                                <span>•</span>
                                                <span style={{ color: 'var(--error)' }}>
                                                    <AlertCircle className="w-3 h-3 inline mr-1" />
                                                    {toolkit.error_message}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Actions Panel */}
                                {isExpanded && toolkit.is_connected && (
                                    <div className="border-t p-5" style={{ borderColor: 'var(--border-primary)', background: 'var(--surface-secondary)' }}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-display font-medium" style={{ color: 'var(--text-primary)' }}>
                                                Available Actions
                                            </h4>
                                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                {actions.filter(a => a.enabled).length} / {actions.length} enabled
                                            </span>
                                        </div>

                                        {loadingActions === toolkit.id ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                                            </div>
                                        ) : actions.length === 0 ? (
                                            <p className="text-sm py-4" style={{ color: 'var(--text-tertiary)' }}>
                                                No actions available for this toolkit.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {actions.map((action) => (
                                                    <div 
                                                        key={action.name}
                                                        className="flex items-center justify-between p-3 rounded-lg"
                                                        style={{ background: 'var(--surface-primary)' }}
                                                    >
                                                        <div>
                                                            <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                {action.name}
                                                            </p>
                                                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                                {action.description}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => toggleAction(toolkit.id, action.name)}
                                                            className="p-1"
                                                        >
                                                            {action.enabled ? (
                                                                <ToggleRight className="w-8 h-8" style={{ color: 'var(--success)' }} />
                                                            ) : (
                                                                <ToggleLeft className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
                                                            )}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
