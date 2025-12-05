// components/ChatInterface.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AI_MODELS, DEFAULT_MODEL, getModelsByProvider, getModelInfo, PROVIDER_INFO, type AIProvider } from '@/config/ai-models';
import { Info, Zap, DollarSign, Layers } from 'lucide-react';
import ChatUploadButton from './chat/ChatUploadButton';

interface ChatInterfaceProps {
    selectedMode: string;
    onGenerateArtifact: (prompt: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
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

    // Load saved model from localStorage on mount
    useEffect(() => {
        const savedModel = localStorage.getItem('selected-ai-model');
        if (savedModel && AI_MODELS.find(m => m.id === savedModel)) {
            setSelectedModel(savedModel);
        }
    }, []);

    // Save model selection to localStorage
    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        localStorage.setItem('selected-ai-model', modelId);
        // Show brief success feedback
        setShowModelInfo(true);
        setTimeout(() => setShowModelInfo(false), 3000);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const message = inputValue.trim();
        setInputValue('');
        setIsLoading(true);
        setStreamingMessage('');

        // Add user message
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            // Build messages array for API (exclude system intro)
            const conversationMessages = messages
                .filter(m => m.id !== 'system-intro')
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));
            
            // Add current user message
            conversationMessages.push({
                role: 'user',
                content: message
            });

            // Manual fetch and stream reading with FULL conversation context
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: conversationMessages, // Send entire conversation history
                    selectedMode,
                    selectedModel,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Check if this is an artifact response
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const jsonResponse = await response.json();
                
                if (jsonResponse.type === 'artifact') {
                    console.log('[ChatInterface] 🎨 Artifact response detected:', jsonResponse.artifactType);
                    
                    // Trigger artifact generation in parent component
                    onGenerateArtifact(message);
                    
                    // Add a message indicating artifact is being generated
                    setMessages(prev => [...prev, {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        content: `✨ Generating ${jsonResponse.artifactType} artifact for you...`,
                    }]);
                    
                    setIsLoading(false);
                    return;
                }
            }

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

            // Add assistant message
            setMessages(prev => [...prev, {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullText,
            }]);
            setStreamingMessage('');

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            // Show error in chat
            setMessages(prev => [...prev, {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `❌ Error: ${errorMessage}\n\nPlease try again or switch to a different model.`,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const currentModel = getModelInfo(selectedModel);
    const modelsByProvider = getModelsByProvider();

    return (
        <div className="flex flex-col h-full bg-gray-50 p-4 border-r">
            {/* Model Selector */}
            <div className="mb-4 pb-4 border-b border-gray-200">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                    AI Model
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

                {/* Model Info Panel */}
                {showModelInfo && currentModel && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2 animate-in fade-in duration-200">
                        <div className="font-semibold text-blue-900 flex items-center gap-2">
                            <Info className="w-3 h-3" />
                            Model switched to {currentModel.name}
                        </div>
                    </div>
                )}

                {/* Current Model Quick Info */}
                {currentModel && !showModelInfo && (
                    <div className="mt-2 p-2 bg-white border rounded text-xs space-y-1.5">
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
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${m.role === 'user'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-800 border shadow-sm'
                            }`}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {streamingMessage && (
                    <div className="flex justify-start">
                        <div className="max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap bg-white text-gray-800 border shadow-sm">
                            {streamingMessage}
                            <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse"></span>
                        </div>
                    </div>
                )}
                {isLoading && !streamingMessage && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full animate-pulse flex items-center gap-2">
                            <Zap className="w-3 h-3" />
                            {currentModel?.name} is thinking...
                        </div>
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
                    placeholder={`Chat in ${selectedMode} Mode...`}
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
