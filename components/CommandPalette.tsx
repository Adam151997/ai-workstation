// components/CommandPalette.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
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
    X
} from 'lucide-react';

interface CommandItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    action: () => void;
    keywords: string[];
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchMode: (mode: string) => void;
    onSwitchModel: () => void;
    onClearConversation: () => void;
    onGenerateArtifact: () => void;
    currentMode: string;
}

export function CommandPalette({
    isOpen,
    onClose,
    onSwitchMode,
    onSwitchModel,
    onClearConversation,
    onGenerateArtifact,
    currentMode,
}: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Define all available commands
    const commands: CommandItem[] = [
        {
            id: 'mode-sales',
            label: 'Switch to Sales Mode',
            description: 'CRM, email, and calendar tools',
            icon: <Briefcase className="w-4 h-4" />,
            action: () => onSwitchMode('Sales'),
            keywords: ['sales', 'mode', 'crm', 'hubspot', 'calendly'],
        },
        {
            id: 'mode-marketing',
            label: 'Switch to Marketing Mode',
            description: 'Content creation and campaign management',
            icon: <TrendingUp className="w-4 h-4" />,
            action: () => onSwitchMode('Marketing'),
            keywords: ['marketing', 'mode', 'content', 'campaign'],
        },
        {
            id: 'mode-admin',
            label: 'Switch to Admin Mode',
            description: 'Internal operations and management',
            icon: <SettingsIcon className="w-4 h-4" />,
            action: () => onSwitchMode('Admin'),
            keywords: ['admin', 'mode', 'operations', 'management'],
        },
        {
            id: 'change-model',
            label: 'Change AI Model',
            description: 'Switch between available AI models',
            icon: <Cpu className="w-4 h-4" />,
            action: onSwitchModel,
            keywords: ['model', 'ai', 'llama', 'gpt', 'groq', 'openai'],
        },
        {
            id: 'clear-chat',
            label: 'Clear Conversation',
            description: 'Remove all messages and start fresh',
            icon: <Trash2 className="w-4 h-4" />,
            action: onClearConversation,
            keywords: ['clear', 'delete', 'reset', 'conversation', 'chat'],
        },
        {
            id: 'generate-artifact',
            label: 'Generate Artifact',
            description: 'Create a new generative artifact',
            icon: <Sparkles className="w-4 h-4" />,
            action: onGenerateArtifact,
            keywords: ['generate', 'artifact', 'create', 'new'],
        },
    ];

    // Filter commands based on search
    const filteredCommands = commands.filter((command) => {
        if (!search) return true;
        
        const searchLower = search.toLowerCase();
        return (
            command.label.toLowerCase().includes(searchLower) ||
            command.description.toLowerCase().includes(searchLower) ||
            command.keywords.some((keyword) => keyword.includes(searchLower))
        );
    });

    // Reset selected index when filtered commands change
    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

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
                    break;
            }
        },
        [isOpen, filteredCommands, selectedIndex, onClose]
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
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Command Palette */}
            <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 animate-in zoom-in-95 duration-200">
                <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
                        <Command className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">
                            Command Palette
                        </span>
                        <button
                            onClick={onClose}
                            className="ml-auto p-1 hover:bg-gray-200 rounded"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="p-3 border-b border-gray-200">
                        <Input
                            type="text"
                            placeholder="Search commands..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full"
                            autoFocus
                        />
                    </div>

                    {/* Commands List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {filteredCommands.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No commands found</p>
                            </div>
                        ) : (
                            <div className="py-2">
                                {filteredCommands.map((command, index) => (
                                    <button
                                        key={command.id}
                                        onClick={() => {
                                            command.action();
                                            onClose();
                                            setSearch('');
                                        }}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                            index === selectedIndex
                                                ? 'bg-blue-50 border-l-2 border-blue-500'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div
                                            className={`p-2 rounded ${
                                                index === selectedIndex
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
                                        {index === selectedIndex && (
                                            <div className="text-xs text-gray-400 flex items-center gap-1">
                                                <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">
                                                    ↵
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                ))}
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
                            {filteredCommands.length} commands
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
