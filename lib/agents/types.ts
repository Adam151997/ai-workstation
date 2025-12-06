// lib/agents/types.ts
// Agent System Type Definitions

import { LoadedTool } from '@/lib/tools/dynamic-loader';

// =============================================================================
// Agent Identity
// =============================================================================

export type AgentRole = 
    | 'router'      // Routes queries to specialists
    | 'sales'       // CRM, deals, pipelines
    | 'marketing'   // Campaigns, content, social
    | 'research'    // Web search, analysis
    | 'code'        // Development, debugging
    | 'data'        // Analytics, visualization
    | 'general';    // Fallback for general queries

export interface AgentIdentity {
    id: string;
    role: AgentRole;
    name: string;
    description: string;
    avatar?: string;
    color?: string;
}

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
    identity: AgentIdentity;
    systemPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    toolCategories?: string[];      // Which toolkit categories this agent can use
    requiredCapabilities?: string[]; // Required capabilities to activate
    fallbackAgent?: AgentRole;       // Who to delegate to if unable to handle
}

// =============================================================================
// Agent Context
// =============================================================================

export interface AgentContext {
    userId: string;
    conversationId: string;
    tools: LoadedTool[];
    memory?: AgentMemory;
    parentAgent?: AgentRole;        // For sub-agent delegation
    executionId?: string;           // For tracking multi-agent flows
}

export interface AgentMemory {
    shortTerm: MemoryItem[];        // Current conversation
    longTerm: MemoryItem[];         // Cross-conversation knowledge
    workingMemory: Record<string, any>; // Temporary computation state
}

export interface MemoryItem {
    id: string;
    type: 'fact' | 'preference' | 'context' | 'decision' | 'outcome';
    content: string;
    source: AgentRole;
    timestamp: Date;
    relevance?: number;             // 0-1, for retrieval ranking
    metadata?: Record<string, any>;
}

// =============================================================================
// Agent Messages
// =============================================================================

export interface AgentMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    agentId?: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    metadata?: MessageMetadata;
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

export interface ToolResult {
    callId: string;
    name: string;
    result: any;
    error?: string;
}

export interface MessageMetadata {
    tokens?: number;
    latency?: number;
    model?: string;
    confidence?: number;
    reasoning?: string;
}

// =============================================================================
// Agent Response
// =============================================================================

export interface AgentResponse {
    content: string;
    agentId: string;
    agentRole: AgentRole;
    toolsUsed?: string[];
    delegatedTo?: AgentRole;
    metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
    reasoning?: string;
    confidence?: number;
    tokens?: { input: number; output: number };
    latency?: number;
    model?: string;
    sources?: string[];
}

// =============================================================================
// Router Types
// =============================================================================

export interface RoutingDecision {
    targetAgent: AgentRole;
    confidence: number;
    reasoning: string;
    suggestedTools?: string[];
    requiresMultiAgent?: boolean;
    agentSequence?: AgentRole[];    // For multi-agent collaboration
}

export interface RoutingContext {
    query: string;
    conversationHistory: AgentMessage[];
    availableAgents: AgentRole[];
    userToolkits: string[];         // Which toolkits user has connected
    previousRouting?: RoutingDecision;
}

// =============================================================================
// Crew Types (Multi-Agent Orchestration)
// =============================================================================

export interface CrewConfig {
    name: string;
    description: string;
    agents: AgentRole[];
    workflow: CrewWorkflow;
}

export type CrewWorkflow = 
    | 'sequential'      // Agents run one after another
    | 'parallel'        // Agents run simultaneously
    | 'hierarchical'    // Router delegates, agents may sub-delegate
    | 'consensus';      // Agents vote on best response

export interface CrewTask {
    id: string;
    description: string;
    assignedAgent: AgentRole;
    dependencies?: string[];        // Task IDs that must complete first
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

export interface CrewExecution {
    id: string;
    crewConfig: CrewConfig;
    tasks: CrewTask[];
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'failed';
    finalResponse?: AgentResponse;
}

// =============================================================================
// Agent Events (for observability)
// =============================================================================

export type AgentEvent = 
    | { type: 'agent_started'; agentId: string; query: string }
    | { type: 'tool_called'; agentId: string; tool: string; args: any }
    | { type: 'tool_result'; agentId: string; tool: string; result: any }
    | { type: 'delegation'; from: AgentRole; to: AgentRole; reason: string }
    | { type: 'agent_completed'; agentId: string; response: AgentResponse }
    | { type: 'agent_error'; agentId: string; error: string };

export interface AgentEventHandler {
    onEvent: (event: AgentEvent) => void;
}

// =============================================================================
// Agent Registry
// =============================================================================

export interface AgentRegistry {
    agents: Map<AgentRole, AgentConfig>;
    getAgent: (role: AgentRole) => AgentConfig | undefined;
    getAvailableAgents: (context: AgentContext) => AgentRole[];
}
