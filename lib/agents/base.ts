// lib/agents/base.ts
// Base Agent Class - Foundation for all specialist agents

import {
    AgentConfig,
    AgentContext,
    AgentMessage,
    AgentResponse,
    AgentRole,
    AgentEvent,
    AgentEventHandler,
    ToolCall,
    ToolResult,
    ResponseMetadata,
} from './types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

// =============================================================================
// Base Agent Class
// =============================================================================

export abstract class BaseAgent {
    protected config: AgentConfig;
    protected eventHandler?: AgentEventHandler;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    // =========================================================================
    // Public Interface
    // =========================================================================

    get id(): string {
        return this.config.identity.id;
    }

    get role(): AgentRole {
        return this.config.identity.role;
    }

    get name(): string {
        return this.config.identity.name;
    }

    get description(): string {
        return this.config.identity.description;
    }

    /**
     * Set event handler for observability
     */
    setEventHandler(handler: AgentEventHandler): void {
        this.eventHandler = handler;
    }

    /**
     * Main entry point - process a user query
     */
    async process(
        query: string,
        context: AgentContext,
        history: AgentMessage[] = []
    ): Promise<AgentResponse> {
        const startTime = Date.now();
        
        this.emit({ type: 'agent_started', agentId: this.id, query });

        try {
            // Build messages for LLM
            const messages = this.buildMessages(query, context, history);

            // Get available tools for this agent
            const tools = this.filterTools(context.tools);

            // Execute the agent's logic
            const response = await this.execute(messages, tools, context);

            // Calculate metadata
            const latency = Date.now() - startTime;
            response.metadata = {
                ...response.metadata,
                latency,
            };

            this.emit({ type: 'agent_completed', agentId: this.id, response });

            return response;

        } catch (error: any) {
            this.emit({ type: 'agent_error', agentId: this.id, error: error.message });
            throw error;
        }
    }

    /**
     * Check if this agent can handle the given query
     */
    canHandle(query: string, context: AgentContext): boolean {
        // Check if required capabilities are met
        if (this.config.requiredCapabilities) {
            const userToolCategories = context.tools.map(t => t.toolkit);
            const hasRequired = this.config.requiredCapabilities.every(
                cap => userToolCategories.includes(cap)
            );
            if (!hasRequired) return false;
        }

        // Subclasses can override for more specific logic
        return true;
    }

    // =========================================================================
    // Protected Methods (for subclasses)
    // =========================================================================

    /**
     * Execute the agent's core logic - MUST be implemented by subclasses
     */
    protected abstract execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse>;

    /**
     * Build the system prompt with context
     */
    protected buildSystemPrompt(context: AgentContext): string {
        let prompt = this.config.systemPrompt;

        // Add available tools information
        const tools = this.filterTools(context.tools);
        if (tools.length > 0) {
            prompt += `\n\n## Available Tools\n`;
            tools.forEach(tool => {
                prompt += `- **${tool.name}**: ${tool.description}\n`;
            });
        }

        // Add memory context if available
        if (context.memory?.shortTerm.length) {
            prompt += `\n\n## Recent Context\n`;
            context.memory.shortTerm.slice(-5).forEach(item => {
                prompt += `- ${item.content}\n`;
            });
        }

        return prompt;
    }

    /**
     * Build messages array for LLM
     */
    protected buildMessages(
        query: string,
        context: AgentContext,
        history: AgentMessage[]
    ): AgentMessage[] {
        const messages: AgentMessage[] = [];

        // System prompt
        messages.push({
            role: 'system',
            content: this.buildSystemPrompt(context),
            agentId: this.id,
        });

        // Conversation history
        messages.push(...history);

        // Current query
        messages.push({
            role: 'user',
            content: query,
        });

        return messages;
    }

    /**
     * Filter tools to only those this agent should use
     */
    protected filterTools(tools: LoadedTool[]): LoadedTool[] {
        if (!this.config.toolCategories || this.config.toolCategories.length === 0) {
            return tools; // No filter, use all
        }

        return tools.filter(tool => 
            this.config.toolCategories!.includes(tool.toolkit)
        );
    }

    /**
     * Execute a tool call
     */
    protected async executeTool(
        tool: LoadedTool,
        args: Record<string, any>
    ): Promise<ToolResult> {
        this.emit({ 
            type: 'tool_called', 
            agentId: this.id, 
            tool: tool.name, 
            args 
        });

        try {
            const result = await tool.execute(args);
            
            this.emit({ 
                type: 'tool_result', 
                agentId: this.id, 
                tool: tool.name, 
                result 
            });

            return {
                callId: `${tool.name}-${Date.now()}`,
                name: tool.name,
                result,
            };

        } catch (error: any) {
            return {
                callId: `${tool.name}-${Date.now()}`,
                name: tool.name,
                result: null,
                error: error.message,
            };
        }
    }

    /**
     * Delegate to another agent
     */
    protected async delegate(
        targetRole: AgentRole,
        query: string,
        context: AgentContext,
        reason: string
    ): Promise<AgentResponse | null> {
        this.emit({
            type: 'delegation',
            from: this.role,
            to: targetRole,
            reason,
        });

        // Return null - caller should handle actual delegation via AgentCrew
        return null;
    }

    /**
     * Emit an event for observability
     */
    protected emit(event: AgentEvent): void {
        if (this.eventHandler) {
            this.eventHandler.onEvent(event);
        }
        // Also log for debugging
        console.log(`[Agent:${this.id}]`, event.type, event);
    }

    /**
     * Create a standard response
     */
    protected createResponse(
        content: string,
        metadata?: Partial<ResponseMetadata>,
        toolsUsed?: string[]
    ): AgentResponse {
        return {
            content,
            agentId: this.id,
            agentRole: this.role,
            toolsUsed,
            metadata: metadata as ResponseMetadata,
        };
    }
}

// =============================================================================
// LLM Integration Helper
// =============================================================================

export interface LLMConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey?: string;
}

export async function callLLM(
    messages: AgentMessage[],
    config: LLMConfig,
    tools?: LoadedTool[]
): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: { input: number; output: number } }> {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
    }

    // Convert messages to OpenAI format
    const openaiMessages = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
    }));

    // Convert tools to OpenAI function format
    const functions = tools?.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} },
    }));

    const body: any = {
        model: config.model,
        messages: openaiMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
    };

    if (functions && functions.length > 0) {
        body.functions = functions;
        body.function_call = 'auto';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // Handle function calls
    let toolCalls: ToolCall[] | undefined;
    if (choice.message.function_call) {
        toolCalls = [{
            id: `call-${Date.now()}`,
            name: choice.message.function_call.name,
            arguments: JSON.parse(choice.message.function_call.arguments || '{}'),
        }];
    }

    return {
        content: choice.message.content || '',
        toolCalls,
        usage: data.usage ? {
            input: data.usage.prompt_tokens,
            output: data.usage.completion_tokens,
        } : undefined,
    };
}

// =============================================================================
// Agent Factory
// =============================================================================

export type AgentConstructor = new (config: AgentConfig) => BaseAgent;

const agentRegistry: Map<AgentRole, AgentConstructor> = new Map();

export function registerAgent(role: AgentRole, constructor: AgentConstructor): void {
    agentRegistry.set(role, constructor);
}

export function createAgent(role: AgentRole, config: AgentConfig): BaseAgent | null {
    const Constructor = agentRegistry.get(role);
    if (!Constructor) {
        console.warn(`[AgentFactory] No agent registered for role: ${role}`);
        return null;
    }
    return new Constructor(config);
}

export function getRegisteredAgents(): AgentRole[] {
    return Array.from(agentRegistry.keys());
}
