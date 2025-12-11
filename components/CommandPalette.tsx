// components/CommandPalette.tsx
// Enhanced Command Palette with comprehensive commands
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from './ui/input';
import { 
    Command, 
    Zap, 
    Briefcase, 
    TrendingUp, 
    Settings as SettingsIcon, 
    Trash2, 
    Sparkles,
    Cpu,
    X,
    FileText,
    FolderOpen,
    Tag,
    BookOpen,
    Workflow,
    Database,
    CreditCard,
    Activity,
    BarChart3,
    Users,
    Plus,
    Upload,
    Search,
    RefreshCw,
    Brain,
    Wrench,
    Store,
    Clock,
    Home,
    MessageSquare,
    Moon,
    Sun,
    Download,
    Share,
    Copy,
    Eye,
    Play,
    Pause,
    RotateCcw,
    HelpCircle,
    ExternalLink,
    Globe,
    Shield,
    Key,
    Bell,
    Layout
} from 'lucide-react';

interface CommandItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void;
    keywords: string[];
    category: 'navigation' | 'actions' | 'modes' | 'settings' | 'quick';
    shortcut?: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchMode: (mode: string) => void;
    onSwitchModel: () => void;
    onClearConversation: () => void;
    onGenerateArtifact: () => void;
    onToggleAgentMode?: () => void;
    onUploadDocument?: () => void;
    currentMode: string;
    agentModeEnabled?: boolean;
}

export function CommandPalette({
    isOpen,
    onClose,
    onSwitchMode,
    onSwitchModel,
    onClearConversation,
    onGenerateArtifact,
    onToggleAgentMode,
    onUploadDocument,
    currentMode,
    agentModeEnabled = false,
}: CommandPaletteProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Helper for navigation
    const navigate = (path: string) => {
        router.push(path);
        onClose();
    };

    // Define all available commands
    const commands: CommandItem[] = [
        // === NAVIGATION ===
        {
            id: 'nav-home',
            label: 'Go to Workstation',
            description: 'Open the main chat workstation',
            icon: <Home className="w-4 h-4" />,
            action: () => navigate('/workstation'),
            keywords: ['home', 'workstation', 'chat', 'main'],
            category: 'navigation',
            shortcut: 'G H',
        },
        {
            id: 'nav-settings',
            label: 'Go to Settings',
            description: 'Open settings overview',
            icon: <SettingsIcon className="w-4 h-4" />,
            action: () => navigate('/settings'),
            keywords: ['settings', 'preferences', 'config'],
            category: 'navigation',
            shortcut: 'G S',
        },
        {
            id: 'nav-documents',
            label: 'Go to Documents',
            description: 'View and manage your documents',
            icon: <FileText className="w-4 h-4" />,
            action: () => navigate('/settings/projects'),
            keywords: ['documents', 'files', 'uploads'],
            category: 'navigation',
        },
        {
            id: 'nav-projects',
            label: 'Go to Projects',
            description: 'Manage document projects',
            icon: <FolderOpen className="w-4 h-4" />,
            action: () => navigate('/settings/projects'),
            keywords: ['projects', 'folders', 'organize'],
            category: 'navigation',
        },
        {
            id: 'nav-tags',
            label: 'Go to Tags',
            description: 'Manage document tags',
            icon: <Tag className="w-4 h-4" />,
            action: () => navigate('/settings/tags'),
            keywords: ['tags', 'labels', 'categorize'],
            category: 'navigation',
        },
        {
            id: 'nav-agents',
            label: 'Go to Agents',
            description: 'Configure AI agents',
            icon: <Users className="w-4 h-4" />,
            action: () => navigate('/settings/agents'),
            keywords: ['agents', 'ai', 'specialists'],
            category: 'navigation',
        },
        {
            id: 'nav-memories',
            label: 'Go to Memories',
            description: 'View and manage agent memories',
            icon: <Brain className="w-4 h-4" />,
            action: () => navigate('/settings/memories'),
            keywords: ['memories', 'context', 'remember'],
            category: 'navigation',
        },
        {
            id: 'nav-tools',
            label: 'Go to Tools',
            description: 'Manage your enabled tools',
            icon: <Wrench className="w-4 h-4" />,
            action: () => navigate('/settings/tools'),
            keywords: ['tools', 'integrations', 'mcp'],
            category: 'navigation',
        },
        {
            id: 'nav-toolkit-store',
            label: 'Go to Toolkit Store',
            description: 'Browse and install toolkits',
            icon: <Store className="w-4 h-4" />,
            action: () => navigate('/settings/toolkit-store'),
            keywords: ['store', 'marketplace', 'toolkits', 'install'],
            category: 'navigation',
        },
        {
            id: 'nav-data-sources',
            label: 'Go to Data Sources',
            description: 'Configure ETL data sources',
            icon: <Database className="w-4 h-4" />,
            action: () => navigate('/settings/data-sources'),
            keywords: ['data', 'sources', 'etl', 'sync', 'google', 'drive'],
            category: 'navigation',
        },
        {
            id: 'nav-jobs',
            label: 'Go to Background Jobs',
            description: 'Monitor background tasks',
            icon: <Clock className="w-4 h-4" />,
            action: () => navigate('/settings/jobs'),
            keywords: ['jobs', 'tasks', 'background', 'queue'],
            category: 'navigation',
        },
        {
            id: 'nav-billing',
            label: 'Go to Billing',
            description: 'View usage and billing',
            icon: <CreditCard className="w-4 h-4" />,
            action: () => navigate('/settings/billing'),
            keywords: ['billing', 'usage', 'subscription', 'plan'],
            category: 'navigation',
        },
        {
            id: 'nav-activity',
            label: 'Go to Activity',
            description: 'View audit logs and activity',
            icon: <Activity className="w-4 h-4" />,
            action: () => navigate('/settings/activity'),
            keywords: ['activity', 'audit', 'logs', 'history'],
            category: 'navigation',
        },
        {
            id: 'nav-observability',
            label: 'Go to Observability',
            description: 'View metrics and performance',
            icon: <BarChart3 className="w-4 h-4" />,
            action: () => navigate('/settings/observability'),
            keywords: ['observability', 'metrics', 'performance', 'monitoring'],
            category: 'navigation',
        },

        // === MODE SWITCHING ===
        {
            id: 'mode-sales',
            label: 'Switch to Sales Mode',
            description: 'CRM, email, and calendar tools',
            icon: <Briefcase className="w-4 h-4" />,
            action: () => onSwitchMode('Sales'),
            keywords: ['sales', 'mode', 'crm', 'hubspot', 'calendly'],
            category: 'modes',
        },
        {
            id: 'mode-marketing',
            label: 'Switch to Marketing Mode',
            description: 'Content creation and campaign management',
            icon: <TrendingUp className="w-4 h-4" />,
            action: () => onSwitchMode('Marketing'),
            keywords: ['marketing', 'mode', 'content', 'campaign'],
            category: 'modes',
        },
        {
            id: 'mode-admin',
            label: 'Switch to Admin Mode',
            description: 'Internal operations and management',
            icon: <SettingsIcon className="w-4 h-4" />,
            action: () => onSwitchMode('Admin'),
            keywords: ['admin', 'mode', 'operations', 'management'],
            category: 'modes',
        },

        // === ACTIONS ===
        {
            id: 'action-new-chat',
            label: 'New Conversation',
            description: 'Start a fresh conversation',
            icon: <MessageSquare className="w-4 h-4" />,
            action: () => {
                onClearConversation();
                onClose();
            },
            keywords: ['new', 'chat', 'conversation', 'fresh', 'start'],
            category: 'actions',
            shortcut: '⌘ N',
        },
        {
            id: 'action-clear',
            label: 'Clear Conversation',
            description: 'Remove all messages and start fresh',
            icon: <Trash2 className="w-4 h-4" />,
            action: onClearConversation,
            keywords: ['clear', 'delete', 'reset', 'conversation', 'chat'],
            category: 'actions',
        },
        {
            id: 'action-upload',
            label: 'Upload Document',
            description: 'Upload a document for RAG',
            icon: <Upload className="w-4 h-4" />,
            action: () => {
                if (onUploadDocument) onUploadDocument();
                else navigate('/settings/projects');
            },
            keywords: ['upload', 'document', 'file', 'import'],
            category: 'actions',
            shortcut: '⌘ U',
        },
        {
            id: 'action-artifact',
            label: 'Generate Artifact',
            description: 'Create a new generative artifact',
            icon: <Sparkles className="w-4 h-4" />,
            action: onGenerateArtifact,
            keywords: ['generate', 'artifact', 'create', 'new', 'table', 'chart'],
            category: 'actions',
        },
        {
            id: 'action-model',
            label: 'Change AI Model',
            description: 'Switch between available AI models',
            icon: <Cpu className="w-4 h-4" />,
            action: onSwitchModel,
            keywords: ['model', 'ai', 'llama', 'gpt', 'groq', 'openai'],
            category: 'actions',
        },
        {
            id: 'action-agent-mode',
            label: agentModeEnabled ? 'Disable Agent Mode' : 'Enable Agent Mode',
            description: agentModeEnabled ? 'Switch to direct chat' : 'Enable multi-agent routing',
            icon: <Users className="w-4 h-4" />,
            action: () => {
                if (onToggleAgentMode) onToggleAgentMode();
                onClose();
            },
            keywords: ['agent', 'mode', 'toggle', 'routing', 'multi'],
            category: 'actions',
        },
        {
            id: 'action-sync-data',
            label: 'Sync Data Sources',
            description: 'Trigger ETL sync for all sources',
            icon: <RefreshCw className="w-4 h-4" />,
            action: () => navigate('/settings/data-sources'),
            keywords: ['sync', 'refresh', 'data', 'etl', 'update'],
            category: 'actions',
        },
        {
            id: 'action-consolidate-memory',
            label: 'Consolidate Memories',
            description: 'Merge duplicate agent memories',
            icon: <Brain className="w-4 h-4" />,
            action: () => navigate('/settings/memories'),
            keywords: ['consolidate', 'merge', 'memory', 'cleanup'],
            category: 'actions',
        },

        // === QUICK ACCESS ===
        {
            id: 'quick-search-docs',
            label: 'Search Documents',
            description: 'Search across all your documents',
            icon: <Search className="w-4 h-4" />,
            action: () => navigate('/settings/projects'),
            keywords: ['search', 'find', 'documents', 'query'],
            category: 'quick',
            shortcut: '⌘ F',
        },
        {
            id: 'quick-recent-activity',
            label: 'Recent Activity',
            description: 'View your recent actions',
            icon: <Clock className="w-4 h-4" />,
            action: () => navigate('/settings/activity'),
            keywords: ['recent', 'activity', 'history', 'timeline'],
            category: 'quick',
        },
        {
            id: 'quick-help',
            label: 'Help & Documentation',
            description: 'Get help using the workstation',
            icon: <HelpCircle className="w-4 h-4" />,
            action: () => window.open('https://docs.anthropic.com', '_blank'),
            keywords: ['help', 'docs', 'documentation', 'support'],
            category: 'quick',
            shortcut: '?',
        },
        {
            id: 'quick-feedback',
            label: 'Send Feedback',
            description: 'Report issues or suggest features',
            icon: <MessageSquare className="w-4 h-4" />,
            action: () => window.open('https://github.com', '_blank'),
            keywords: ['feedback', 'report', 'bug', 'feature', 'suggest'],
            category: 'quick',
        },

        // === SETTINGS ===
        {
            id: 'settings-api-keys',
            label: 'API Keys',
            description: 'Manage your API keys',
            icon: <Key className="w-4 h-4" />,
            action: () => navigate('/settings'),
            keywords: ['api', 'keys', 'tokens', 'authentication'],
            category: 'settings',
        },
        {
            id: 'settings-notifications',
            label: 'Notifications',
            description: 'Configure notification preferences',
            icon: <Bell className="w-4 h-4" />,
            action: () => navigate('/settings'),
            keywords: ['notifications', 'alerts', 'notify'],
            category: 'settings',
        },
    ];

    // Filter commands based on search and category
    const filteredCommands = commands.filter((command) => {
        if (selectedCategory && command.category !== selectedCategory) return false;
        if (!search) return true;
        
        const searchLower = search.toLowerCase();
        return (
            command.label.toLowerCase().includes(searchLower) ||
            command.description.toLowerCase().includes(searchLower) ||
            command.keywords.some((keyword) => keyword.includes(searchLower))
        );
    });

    // Group commands by category for display
    const groupedCommands = filteredCommands.reduce((acc, cmd) => {
        if (!acc[cmd.category]) acc[cmd.category] = [];
        acc[cmd.category].push(cmd);
        return acc;
    }, {} as Record<string, CommandItem[]>);

    const categoryLabels: Record<string, string> = {
        navigation: '📍 Navigation',
        actions: '⚡ Actions',
        modes: '🎯 Mode Switching',
        settings: '⚙️ Settings',
        quick: '🚀 Quick Access',
    };

    const categoryOrder = ['actions', 'navigation', 'modes', 'quick', 'settings'];

    // Reset selected index when filtered commands change
    useEffect(() => {
        setSelectedIndex(0);
    }, [search, selectedCategory]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                        prev < filteredCommands.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        filteredCommands[selectedIndex].action();
                        onClose();
                        setSearch('');
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    setSearch('');
                    setSelectedCategory(null);
                    break;
                case 'Tab':
                    e.preventDefault();
                    // Cycle through categories
                    const currentIdx = selectedCategory 
                        ? categoryOrder.indexOf(selectedCategory)
                        : -1;
                    const nextIdx = (currentIdx + 1) % (categoryOrder.length + 1);
                    setSelectedCategory(nextIdx === categoryOrder.length ? null : categoryOrder[nextIdx]);
                    break;
            }
        },
        [isOpen, filteredCommands, selectedIndex, selectedCategory, onClose]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Reset search when closing
    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setSelectedCategory(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Flatten grouped commands for index tracking
    let flatIndex = 0;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Command Palette */}
            <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 animate-in zoom-in-95 duration-200">
                <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                        <Command className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">
                            Command Palette
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                            {filteredCommands.length} commands
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-200 rounded"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                placeholder="Search commands... (Tab to filter by category)"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10"
                                autoFocus
                            />
                        </div>
                        
                        {/* Category Pills */}
                        <div className="flex gap-2 mt-3 overflow-x-auto">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition ${
                                    !selectedCategory 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                All
                            </button>
                            {categoryOrder.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition ${
                                        selectedCategory === cat 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {categoryLabels[cat]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Commands List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {filteredCommands.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No commands found</p>
                                <p className="text-xs mt-1 text-gray-400">Try a different search term</p>
                            </div>
                        ) : (
                            <div className="py-2">
                                {categoryOrder.map(category => {
                                    const categoryCommands = groupedCommands[category];
                                    if (!categoryCommands || categoryCommands.length === 0) return null;
                                    
                                    return (
                                        <div key={category}>
                                            {!selectedCategory && (
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                                                    {categoryLabels[category]}
                                                </div>
                                            )}
                                            {categoryCommands.map((command) => {
                                                const currentIndex = flatIndex++;
                                                const isSelected = currentIndex === selectedIndex;
                                                
                                                return (
                                                    <button
                                                        key={command.id}
                                                        onClick={() => {
                                                            command.action();
                                                            onClose();
                                                            setSearch('');
                                                        }}
                                                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                            isSelected
                                                                ? 'bg-blue-50 border-l-2 border-blue-500'
                                                                : 'hover:bg-gray-50 border-l-2 border-transparent'
                                                        }`}
                                                    >
                                                        <div
                                                            className={`p-2 rounded-lg ${
                                                                isSelected
                                                                    ? 'bg-blue-100 text-blue-600'
                                                                    : 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {command.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {command.label}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate">
                                                                {command.description}
                                                            </div>
                                                        </div>
                                                        {command.shortcut && (
                                                            <div className="text-xs text-gray-400">
                                                                <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">
                                                                    {command.shortcut}
                                                                </kbd>
                                                            </div>
                                                        )}
                                                        {isSelected && (
                                                            <div className="text-xs text-gray-400">
                                                                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">
                                                                    ↵
                                                                </kbd>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">
                                    ↑↓
                                </kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">
                                    Tab
                                </kbd>
                                Filter
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">
                                    ↵
                                </kbd>
                                Select
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">
                                    Esc
                                </kbd>
                                Close
                            </span>
                        </div>
                        <span className="text-gray-400">
                            Mode: <span className="font-medium text-gray-600">{currentMode}</span>
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
