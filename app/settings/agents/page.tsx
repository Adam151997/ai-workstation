// app/settings/agents/page.tsx
// Agent configuration and status page

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, Users, Bot, ChevronRight, Info } from 'lucide-react';

// Agent data from configs
const AGENTS = [
    {
        id: 'router',
        name: 'Router',
        avatar: '🧭',
        color: '#8B5CF6',
        description: 'Analyzes queries and routes to the best specialist agent',
        capabilities: ['Query classification', 'Keyword detection', 'Tool awareness', 'Multi-agent coordination'],
        keywords: [],
        isCore: true,
    },
    {
        id: 'sales',
        name: 'Sales Agent',
        avatar: '💼',
        color: '#10B981',
        description: 'Expert in CRM, deals, pipelines, and customer relationships',
        capabilities: ['CRM management', 'Deal tracking', 'Pipeline analysis', 'Sales forecasting'],
        keywords: ['leads', 'deals', 'pipeline', 'CRM', 'sales', 'customers'],
        tools: ['HubSpot', 'Salesforce'],
    },
    {
        id: 'marketing',
        name: 'Marketing Agent',
        avatar: '📣',
        color: '#F59E0B',
        description: 'Expert in campaigns, content, social media, and marketing automation',
        capabilities: ['Campaign management', 'Content strategy', 'Social media', 'Email marketing'],
        keywords: ['campaign', 'content', 'social', 'email', 'newsletter'],
        tools: ['Mailchimp', 'LinkedIn', 'Twitter'],
    },
    {
        id: 'research',
        name: 'Research Agent',
        avatar: '🔬',
        color: '#3B82F6',
        description: 'Expert in web research, information gathering, and analysis',
        capabilities: ['Web search', 'Competitive analysis', 'Document summarization', 'Fact-checking'],
        keywords: ['research', 'search', 'find', 'analyze', 'compare'],
        tools: ['Web Search', 'Document Analysis'],
    },
    {
        id: 'code',
        name: 'Code Agent',
        avatar: '💻',
        color: '#6366F1',
        description: 'Expert in development, debugging, and technical tasks',
        capabilities: ['Code writing', 'Debugging', 'Code review', 'API integration'],
        keywords: ['code', 'debug', 'develop', 'API', 'script'],
        tools: ['GitHub'],
    },
    {
        id: 'data',
        name: 'Data Agent',
        avatar: '📊',
        color: '#EC4899',
        description: 'Expert in analytics, visualization, and data processing',
        capabilities: ['Data analysis', 'Visualization', 'Spreadsheet operations', 'Statistical analysis'],
        keywords: ['data', 'chart', 'graph', 'spreadsheet', 'metrics'],
        tools: ['Airtable', 'Google Sheets'],
    },
    {
        id: 'general',
        name: 'General Agent',
        avatar: '🤖',
        color: '#6B7280',
        description: 'Versatile assistant for general queries and tasks',
        capabilities: ['General knowledge', 'Writing assistance', 'Explanations', 'Planning'],
        keywords: ['help', 'explain', 'general'],
        tools: ['All available tools'],
        isFallback: true,
    },
];

const CREWS = [
    {
        id: 'full',
        name: 'Full Crew',
        description: 'All specialist agents available',
        agents: ['sales', 'marketing', 'research', 'code', 'data', 'general'],
        workflow: 'hierarchical',
    },
    {
        id: 'salesTeam',
        name: 'Sales Team',
        description: 'Optimized for sales and CRM tasks',
        agents: ['sales', 'data', 'general'],
        workflow: 'sequential',
    },
    {
        id: 'marketingTeam',
        name: 'Marketing Team',
        description: 'Optimized for marketing and content tasks',
        agents: ['marketing', 'research', 'general'],
        workflow: 'sequential',
    },
    {
        id: 'techTeam',
        name: 'Tech Team',
        description: 'Optimized for development and data tasks',
        agents: ['code', 'data', 'research', 'general'],
        workflow: 'hierarchical',
    },
];

export default function AgentsSettingsPage() {
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Users className="w-8 h-8 text-purple-600" />
                    Agent System
                </h1>
                <p className="text-gray-600 mt-2">
                    Multi-agent intelligence that routes your queries to specialized experts.
                </p>
            </div>

            {/* How it works */}
            <Card className="mb-8 border-purple-200 bg-purple-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-800">
                        <Info className="w-5 h-5" />
                        How Agent Mode Works
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-purple-900 space-y-2">
                    <p>
                        When you enable <strong>Agent Mode</strong> in chat, your queries go through an intelligent routing system:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                        <li>The <strong>Router</strong> analyzes your query using keywords and context</li>
                        <li>It selects the best <strong>Specialist Agent</strong> for your task</li>
                        <li>The specialist processes your query with domain expertise</li>
                        <li>Results include routing reasoning and confidence scores</li>
                    </ol>
                    <p className="text-purple-700 italic">
                        Cross-conversation memory helps agents remember context from previous chats.
                    </p>
                </CardContent>
            </Card>

            {/* Agents Grid */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    Specialist Agents
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {AGENTS.map((agent) => (
                        <Card 
                            key={agent.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedAgent === agent.id ? 'ring-2' : ''
                            }`}
                            style={{ 
                                borderLeftColor: agent.color, 
                                borderLeftWidth: '4px',
                                ...(selectedAgent === agent.id ? { ringColor: agent.color } : {})
                            }}
                            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <span className="text-2xl">{agent.avatar}</span>
                                        {agent.name}
                                    </CardTitle>
                                    <div className="flex gap-1">
                                        {agent.isCore && (
                                            <Badge variant="secondary" className="text-xs">Core</Badge>
                                        )}
                                        {agent.isFallback && (
                                            <Badge variant="outline" className="text-xs">Fallback</Badge>
                                        )}
                                    </div>
                                </div>
                                <CardDescription className="text-sm">
                                    {agent.description}
                                </CardDescription>
                            </CardHeader>
                            
                            {selectedAgent === agent.id && (
                                <CardContent className="pt-0 space-y-3">
                                    {/* Capabilities */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 mb-1">Capabilities</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {agent.capabilities.map((cap, i) => (
                                                <Badge key={i} variant="secondary" className="text-xs">
                                                    {cap}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Keywords */}
                                    {agent.keywords.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 mb-1">Trigger Keywords</h4>
                                            <p className="text-xs text-gray-600">
                                                {agent.keywords.join(', ')}
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* Tools */}
                                    {agent.tools && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 mb-1">Preferred Tools</h4>
                                            <p className="text-xs text-gray-600">
                                                {agent.tools.join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>
            </div>

            {/* Crews Section */}
            <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Agent Crews
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    Pre-configured teams of agents optimized for specific workflows.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CREWS.map((crew) => (
                        <Card key={crew.id}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    {crew.name}
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {crew.workflow}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>{crew.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {crew.agents.map((agentId) => {
                                        const agent = AGENTS.find(a => a.id === agentId);
                                        return agent ? (
                                            <div 
                                                key={agentId}
                                                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                                                style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                                            >
                                                <span>{agent.avatar}</span>
                                                <span>{agent.name.replace(' Agent', '')}</span>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Memory Section */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-purple-600" />
                        Cross-Context Memory
                    </CardTitle>
                    <CardDescription>
                        Agents remember context from your previous conversations
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        {[
                            { type: 'Facts', icon: '📋', desc: 'Factual information' },
                            { type: 'Preferences', icon: '⭐', desc: 'Your preferences' },
                            { type: 'Context', icon: '🔗', desc: 'Conversation context' },
                            { type: 'Decisions', icon: '✅', desc: 'Decisions made' },
                            { type: 'Outcomes', icon: '🎯', desc: 'Results & outcomes' },
                        ].map((mem) => (
                            <div key={mem.type} className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-2xl mb-1">{mem.icon}</div>
                                <div className="font-medium text-sm">{mem.type}</div>
                                <div className="text-xs text-gray-500">{mem.desc}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
