// components/chat/AgentModeToggle.tsx
// Toggle for enabling multi-agent routing mode

'use client';

import { useState } from 'react';
import { Bot, Users, Info } from 'lucide-react';

interface AgentModeToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
}

export function AgentModeToggle({ enabled, onToggle }: AgentModeToggleProps) {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onToggle(!enabled)}
                    className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                        transition-all duration-200
                        ${enabled 
                            ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                        }
                    `}
                    title={enabled ? 'Multi-agent mode enabled' : 'Enable multi-agent mode'}
                >
                    {enabled ? (
                        <Users className="w-4 h-4" />
                    ) : (
                        <Bot className="w-4 h-4" />
                    )}
                    <span>{enabled ? 'Agent Mode' : 'Standard'}</span>
                </button>
                <button
                    onClick={() => setShowInfo(!showInfo)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <Info className="w-4 h-4" />
                </button>
            </div>

            {/* Info tooltip */}
            {showInfo && (
                <div className="absolute top-full left-0 mt-2 w-72 p-3 bg-white border rounded-lg shadow-lg z-50 text-xs">
                    <div className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        Multi-Agent Mode
                    </div>
                    <p className="text-gray-600 mb-2">
                        When enabled, your queries are intelligently routed to specialized agents:
                    </p>
                    <ul className="space-y-1 text-gray-600">
                        <li className="flex items-center gap-2">
                            <span>💼</span> <strong>Sales</strong> - CRM, deals, pipelines
                        </li>
                        <li className="flex items-center gap-2">
                            <span>📣</span> <strong>Marketing</strong> - Campaigns, content
                        </li>
                        <li className="flex items-center gap-2">
                            <span>🔬</span> <strong>Research</strong> - Web search, analysis
                        </li>
                        <li className="flex items-center gap-2">
                            <span>💻</span> <strong>Code</strong> - Development, debugging
                        </li>
                        <li className="flex items-center gap-2">
                            <span>📊</span> <strong>Data</strong> - Analytics, charts
                        </li>
                    </ul>
                    <p className="text-gray-500 mt-2 italic">
                        Includes cross-conversation memory for context.
                    </p>
                    <button 
                        onClick={() => setShowInfo(false)}
                        className="mt-2 text-purple-600 hover:text-purple-800"
                    >
                        Got it
                    </button>
                </div>
            )}
        </div>
    );
}
