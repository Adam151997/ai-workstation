// components/chat/AgentIndicator.tsx
// Shows which agent is handling the current query

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, Zap } from 'lucide-react';

export interface AgentInfo {
    id: string;
    name: string;
    avatar: string;
    color: string;
}

export interface RoutingInfo {
    targetAgent: string;
    confidence: number;
    reasoning: string;
}

interface AgentIndicatorProps {
    agent: AgentInfo;
    routing?: RoutingInfo;
    toolsUsed?: string[];
    isProcessing?: boolean;
}

export function AgentIndicator({ agent, routing, toolsUsed, isProcessing }: AgentIndicatorProps) {
    const [expanded, setExpanded] = useState(false);

    const confidenceColor = routing 
        ? routing.confidence >= 0.8 ? 'text-green-600' 
        : routing.confidence >= 0.5 ? 'text-yellow-600' 
        : 'text-red-600'
        : 'text-gray-500';

    return (
        <div 
            className="inline-flex flex-col bg-white border rounded-lg shadow-sm overflow-hidden"
            style={{ borderLeftColor: agent.color, borderLeftWidth: '3px' }}
        >
            {/* Main indicator */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
                <span className="text-lg">{agent.avatar}</span>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-800">
                        {agent.name}
                    </span>
                    {isProcessing && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Zap className="w-3 h-3 animate-pulse" />
                            Processing...
                        </span>
                    )}
                </div>
                {routing && (
                    <div className="ml-2 flex items-center gap-1">
                        <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                        />
                        <span className={`text-xs font-medium ${confidenceColor}`}>
                            {Math.round(routing.confidence * 100)}%
                        </span>
                    </div>
                )}
                {(routing || toolsUsed) && (
                    expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
            </button>

            {/* Expanded details */}
            {expanded && (routing || toolsUsed) && (
                <div className="px-3 py-2 bg-gray-50 border-t text-xs space-y-2">
                    {routing && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-gray-500">
                                <Brain className="w-3 h-3" />
                                <span className="font-medium">Routing Decision</span>
                            </div>
                            <p className="text-gray-600 leading-relaxed">
                                {routing.reasoning}
                            </p>
                        </div>
                    )}
                    {toolsUsed && toolsUsed.length > 0 && (
                        <div className="space-y-1">
                            <span className="font-medium text-gray-500">Tools Used:</span>
                            <div className="flex flex-wrap gap-1">
                                {toolsUsed.map((tool, i) => (
                                    <span 
                                        key={i}
                                        className="px-2 py-0.5 bg-white border rounded text-gray-600"
                                    >
                                        {tool.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Compact version for message bubbles
export function AgentBadge({ agent }: { agent: AgentInfo }) {
    return (
        <div 
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
        >
            <span>{agent.avatar}</span>
            <span className="font-medium">{agent.name}</span>
        </div>
    );
}
