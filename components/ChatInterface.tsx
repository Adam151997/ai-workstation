// components/ChatInterface.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AI_MODELS, DEFAULT_MODEL, getModelsByProvider, getModelInfo, PROVIDER_INFO, type AIProvider } from '@/config/ai-models';
import { Info, Zap, DollarSign, Layers } from 'lucide-react';
import ChatUploadButton from './chat/ChatUploadButton';
import { AgentModeToggle } from './chat/AgentModeToggle';
import { AgentIndicator, AgentBadge, type AgentInfo, type RoutingInfo } from './chat/AgentIndicator';

interface ChatInterfaceProps {
    selectedMode: string;
    onGenerateArtifact: (prompt: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    agent?: AgentInfo;
    routing?: RoutingInfo;
    toolsUsed?: string[];
}

export function ChatInterface({ selectedMode, onGenerateArtifact }: ChatInterfaceProps) {
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [messages, setMessages] = useState<Message[]>([{
        id: 'system-intro',
        role: 'assistant',
        content: `Welcome to ${selectedMode} Mode. How can I help you today?`,
    }]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    const [showModelInfo, setShowModelInfo] = useState(false);
    const [agentMode, setAgentMode] = useState(false);
    const [currentAgent, setCurrentAgent] = useState<AgentInfo | null>(null);
    const [conversationId] = useState(`conv-${Date.now()}`);

    // Load saved preferences from localStorage
    useEffect(() => {
        const savedModel = localStorage.getItem('selected-ai-model');
        if (savedModel && AI_MODELS.find(m => m.id === savedModel)) {
            setSelectedModel(savedModel);
        }
        
        const savedAgentMode = localStorage.getItem('agent-mode-enabled');
        if (savedAgentMode === 'true') {
            setAgentMode(true);
        }
    }, []);

    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        localStorage.setItem('selected-ai-model', modelId);
        setShowModelInfo(true);
        setTimeout(() => setShowModelInfo(false), 3000);
    };

    const handleAgentModeToggle = (enabled: boolean) => {
        setAgentMode(enabled);
        localStorage.setItem('agent-mode-enabled', String(enabled));
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue.trim();
        setInputValue('');
        setIsLoading(true);
        setStreamingMessage('');
        setCurrentAgent(null);

        // Add user message
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            // Build messages array for API
            const conversationMessages = messages
                .filter(m => m.id !== 'system-intro')
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));
            
            conversationMessages.push({
                role: 'user',
                content: message
            });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: conversationMessages,
                    selectedMode,
                    selectedModel,
                    useAgentMode: agentMode,
                    conversationId,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            
            // Handle JSON responses (artifacts and agent mode)
            if (contentType?.includes('application/json')) {
                const jsonResponse = await response.json();
                
                // Artifact response
                if (jsonResponse.type === 'artifact') {
                    console.log('[ChatInterface] 🎨 Artifact response:', jsonResponse.artifactType);
                    onGenerateArtifact(message);
                    setMessages(prev => [...prev, {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: `✨ Generating ${jsonResponse.artifactType} artifact for you...`,
                    }]);
                    setIsLoading(false);
                    return;
                }
                
                // Agent response
                if (jsonResponse.type === 'agent') {
                    console.log('[ChatInterface] 🤖 Agent response:', jsonResponse.agent?.name);
                    setCurrentAgent(null);
                    setMessages(prev => [...prev, {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: jsonResponse.content,
                        agent: jsonResponse.agent,
                        routing: jsonResponse.routing,
                        toolsUsed: jsonResponse.toolsUsed,
                    }]);
                    setIsLoading(false);
                    return;
                }
            }

            // Handle streaming response (standard mode)
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullText += chunk;
                    setStreamingMessage(fullText);
                }
            }

            setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullText,
            }]);
            setStreamingMessage('');

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `❌ Error: ${errorMessage}\n\nPlease try again or switch to a different model.`,
            }]);
        } finally {
            setIsLoading(false);
            setCurrentAgent(null);
        }
    };

    const currentModel = getModelInfo(selectedModel);
    const modelsByProvider = getModelsByProvider();

    return (
        <div className="flex flex-col h-full bg-gray-50 p-4 border-r">
            {/* Header Controls */}
            <div className="mb-4 pb-4 border-b border-gray-200 space-y-3">
                {/* Agent Mode Toggle */}
                <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700">
                        Chat Mode
                    </label>
                    <AgentModeToggle 
                        enabled={agentMode} 
                        onToggle={handleAgentModeToggle} 
                    />
                </div>

                {/* Model Selector */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                        AI Model {agentMode && <span className="text-purple-600">(routing uses GPT-4o-mini)</span>}
                    </label>
                    <Select value={selectedModel} onValueChange={handleModelChange}>
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(modelsByProvider).map(([provider, models]) => (
                                <div key={provider}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                                        {PROVIDER_INFO[provider as AIProvider].name}
                                    </div>
                                    {models.map((model) => (
                                        <SelectItem key={model.id} value={model.id}>
                                            <div className="flex flex-col py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{model.name}</span>
                                                    {model.recommended && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                            Recommended
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-500">{model.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </div>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Model Info */}
                {showModelInfo && currentModel && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs animate-in fade-in duration-200">
                        <div className="font-semibold text-blue-900 flex items-center gap-2">
                            <Info className="w-3 h-3" />
                            Model switched to {currentModel.name}
                        </div>
                    </div>
                )}

                {currentModel && !showModelInfo && (
                    <div className="p-2 bg-white border rounded text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-gray-600">
                            <div className="flex items-center gap-1.5">
                                <Layers className="w-3 h-3" />
                                <span>Context: {(currentModel.contextWindow / 1000).toFixed(0)}K tokens</span>
                            </div>
                            {currentModel.maxTokensPerDay && (
                                <div className="flex items-center gap-1.5 text-amber-600">
                                    <Zap className="w-3 h-3" />
                                    <span>Free: {(currentModel.maxTokensPerDay / 1000).toFixed(0)}K/day</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                            <DollarSign className="w-3 h-3" />
                            <span>Cost: ${currentModel.costPer1MTokens.toFixed(2)}/1M tokens</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {messages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Agent badge for agent responses */}
                        {m.role === 'assistant' && m.agent && (
                            <div className="mb-1">
                                <AgentIndicator 
                                    agent={m.agent} 
                                    routing={m.routing}
                                    toolsUsed={m.toolsUsed}
                                />
                            </div>
                        )}
                        <div className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-800 border shadow-sm'
                            }`}
                            style={m.agent ? { borderLeftColor: m.agent.color, borderLeftWidth: '3px' } : undefined}
                        >
                            {m.content}
                        </div>
                    </div>
                ))}
                
                {/* Streaming message */}
                {streamingMessage && (
                    <div className="flex flex-col items-start">
                        <div className="max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap bg-white text-gray-800 border shadow-sm">
                            {streamingMessage}
                            <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse"></span>
                        </div>
                    </div>
                )}
                
                {/* Loading indicator */}
                {isLoading && !streamingMessage && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-2 rounded-lg animate-pulse flex items-center gap-2">
                            {agentMode ? (
                                <>
                                    <span className="text-lg">🧭</span>
                                    <span>Routing to specialist agent...</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-3 h-3" />
                                    <span>{currentModel?.name} is thinking...</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Current agent processing indicator */}
                {isLoading && currentAgent && (
                    <div className="flex justify-start">
                        <AgentIndicator 
                            agent={currentAgent} 
                            isProcessing={true}
                        />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="flex space-x-2 pt-4 border-t border-gray-200">
                <ChatUploadButton 
                    mode={selectedMode}
                    onUploadComplete={() => {
                        console.log('[Chat] Document uploaded successfully');
                    }}
                />
                <Input
                    className="flex-1 bg-white"
                    placeholder={agentMode 
                        ? `Ask anything - agent will route automatically...` 
                        : `Chat in ${selectedMode} Mode...`
                    }
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                    {isLoading ? '...' : 'Send'}
                </Button>
            </form>
        </div>
    );
}
