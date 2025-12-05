'use client';

import { useState, useEffect } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import Link from 'next/link';
import { UnifiedArtifactRenderer } from '@/components/artifacts/UnifiedArtifactRenderer';
import { ChatInterface } from '@/components/ChatInterface';
import { CommandPalette } from '@/components/CommandPalette';
import { generateSmartArtifact } from '@/app/actions/artifacts';
import { Artifact } from '@/config/schemas/artifacts';
import { exportArtifact } from '@/lib/export/artifacts';
import { getConnectionStatus } from '@/app/actions/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODES_CONFIG } from '@/config/modes';
import { Command, Folder, Settings, Workflow, Sparkles, Zap } from 'lucide-react';

export default function WorkstationPage() {
    const [selectedMode, setSelectedMode] = useState<keyof typeof MODES_CONFIG>('Sales');
    const [artifact, setArtifact] = useState<Artifact | null>(null);
    const [artifactStatus, setArtifactStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
    const [connectedApps, setConnectedApps] = useState<string[]>([]);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [chatKey, setChatKey] = useState(0);

    // Global keyboard shortcut for Command Palette (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Fetch connection status on mount
    useEffect(() => {
        const fetchStatus = async () => {
            const apps = await getConnectionStatus();
            setConnectedApps(apps);
        };
        fetchStatus();
    }, []);

    // Function to handle artifact generation
    const handleGenerateArtifact = async (prompt: string) => {
        setArtifact(null);
        setArtifactStatus('running');
        try {
            const { object } = await generateSmartArtifact(prompt);

            for await (const partial of readStreamableValue(object)) {
                if (partial) {
                    setArtifact(partial as Artifact);
                }
            }

            setArtifactStatus('complete');
        } catch (error) {
            console.error("Artifact generation failed:", error);
            setArtifactStatus('error');
        }
    };

    // Handle artifact export
    const handleExportArtifact = async (format: string) => {
        if (artifact) {
            await exportArtifact(artifact, format);
        }
    };

    // Command Palette actions
    const handleClearConversation = () => {
        setChatKey(prev => prev + 1);
    };

    const handleSwitchModel = () => {
        alert('Use the model selector in the chat panel to switch models');
    };

    return (
        <div className="flex" style={{ height: 'calc(100vh - 64px)', background: 'var(--bg-primary)' }}>
            {/* Command Palette */}
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                onSwitchMode={(mode) => setSelectedMode(mode as keyof typeof MODES_CONFIG)}
                onSwitchModel={handleSwitchModel}
                onClearConversation={handleClearConversation}
                onGenerateArtifact={() => handleGenerateArtifact('Generate leads for my business')}
                currentMode={selectedMode}
            />

            {/* Sidebar */}
            <aside className="w-[260px] flex flex-col border-r" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex-1 p-5 overflow-y-auto">
                    {/* Mode Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-display text-[11px] font-semibold tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                                AGENT MODE
                            </h3>
                            <button
                                onClick={() => setIsCommandPaletteOpen(true)}
                                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all hover:border-[var(--accent-primary)] hover:bg-[var(--accent-muted)]"
                                style={{ background: 'var(--surface-hover)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                                title="Open Command Palette (⌘K)"
                            >
                                <Command className="w-4 h-4" />
                            </button>
                        </div>

                        <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as keyof typeof MODES_CONFIG)}>
                            <SelectTrigger className="w-full font-display text-sm" style={{ background: 'var(--surface-secondary)', borderColor: 'var(--border-primary)' }}>
                                <SelectValue placeholder="Select Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(MODES_CONFIG).map((mode) => (
                                    <SelectItem key={mode} value={mode}>
                                        {mode}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Mode Indicator */}
                        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg border font-display text-xs font-medium"
                            style={{ background: 'var(--accent-muted)', borderColor: 'var(--border-accent)', color: 'var(--accent-primary)' }}>
                            <Zap className="w-3 h-3" />
                            <span>{selectedMode} Mode</span>
                            <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
                        </div>

                        {/* Keyboard Shortcut */}
                        <div className="flex items-center gap-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <kbd className="px-2 py-1 rounded border font-mono text-[10px]" style={{ background: 'var(--surface-secondary)', borderColor: 'var(--border-primary)' }}>⌘K</kbd>
                            <span>Commands</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <Link href="/workstation/workflows" 
                        className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        <Workflow className="w-5 h-5" />
                        <span>Workflow Builder</span>
                    </Link>

                    <Link href="/settings"
                        className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>

                    <Link href="/workstation/documents"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg font-display text-sm font-medium transition-all hover:bg-[var(--surface-hover)]"
                        style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                        <Folder className="w-5 h-5" />
                        <span>Documents</span>
                    </Link>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex min-w-0 overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 min-w-0 flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
                    <ChatInterface
                        key={chatKey}
                        selectedMode={selectedMode}
                        onGenerateArtifact={handleGenerateArtifact}
                    />
                </div>

                {/* Artifact Panel */}
                <div className="w-[420px] flex flex-col border-l overflow-hidden hidden lg:flex" style={{ background: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center gap-2 px-5 py-4 border-b font-display text-sm font-semibold" 
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                        <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                        <span>Artifacts</span>
                    </div>
                    <UnifiedArtifactRenderer
                        artifact={artifact}
                        status={artifactStatus}
                        onExport={handleExportArtifact}
                        mode={selectedMode}
                    />
                </div>
            </main>
        </div>
    );
}
