// lib/agents/crew.ts
// Agent Crew - Multi-agent orchestration and collaboration

import {
    AgentRole,
    AgentContext,
    AgentMessage,
    AgentResponse,
    AgentEvent,
    AgentEventHandler,
    CrewConfig,
    CrewWorkflow,
    CrewTask,
    CrewExecution,
    RoutingDecision,
} from './types';
import { AGENT_CONFIGS } from './configs';
import { RouterAgent, getRouter } from './router';
import { createSpecialistAgent } from './specialists';
import { BaseAgent } from './base';
import { LoadedTool, loadUserToolkits } from '@/lib/tools/dynamic-loader';
import { buildMemoryContext, learnFromConversation } from './memory';

// =============================================================================
// Agent Crew Class
// =============================================================================

export class AgentCrew {
    private config: CrewConfig;
    private agents: Map<AgentRole, BaseAgent> = new Map();
    private router: RouterAgent;
    private eventHandler?: AgentEventHandler;
    private currentExecution?: CrewExecution;

    constructor(config: CrewConfig) {
        this.config = config;
        this.router = getRouter();
        this.initializeAgents();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    private initializeAgents(): void {
        for (const role of this.config.agents) {
            if (role !== 'router') {
                const agent = createSpecialistAgent(role as any);
                this.agents.set(role, agent);
            }
        }
        console.log(`[Crew:${this.config.name}] Initialized with ${this.agents.size} agents`);
    }

    setEventHandler(handler: AgentEventHandler): void {
        this.eventHandler = handler;
        // Propagate to all agents
        this.agents.forEach(agent => agent.setEventHandler(handler));
    }

    // =========================================================================
    // Main Execution
    // =========================================================================

    /**
     * Process a query through the crew
     */
    async process(
        query: string,
        context: AgentContext,
        history: AgentMessage[] = []
    ): Promise<AgentResponse> {
        const executionId = `exec-${Date.now()}`;
        
        // Initialize execution tracking
        this.currentExecution = {
            id: executionId,
            crewConfig: this.config,
            tasks: [],
            startTime: new Date(),
            status: 'running',
        };

        try {
            // Route the query
            const routing = await this.routeQuery(query, context, history);

            // Execute based on workflow type
            let response: AgentResponse;

            if (routing.requiresMultiAgent && routing.agentSequence) {
                response = await this.executeMultiAgent(
                    query,
                    routing.agentSequence,
                    context,
                    history
                );
            } else {
                response = await this.executeSingleAgent(
                    query,
                    routing.targetAgent,
                    context,
                    history
                );
            }

            // Complete execution
            this.currentExecution.status = 'completed';
            this.currentExecution.endTime = new Date();
            this.currentExecution.finalResponse = response;

            return response;

        } catch (error: any) {
            this.currentExecution.status = 'failed';
            this.currentExecution.endTime = new Date();
            
            this.emit({
                type: 'agent_error',
                agentId: 'crew',
                error: error.message,
            });

            throw error;
        }
    }

    // =========================================================================
    // Routing
    // =========================================================================

    private async routeQuery(
        query: string,
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<RoutingDecision> {
        const userToolkits = context.tools.map(t => t.toolkit);
        const availableAgents = Array.from(this.agents.keys());

        const routing = await this.router.route(query, {
            query,
            conversationHistory: history,
            availableAgents,
            userToolkits,
        });

        console.log(`[Crew] Routed to ${routing.targetAgent} (confidence: ${routing.confidence})`);

        return routing;
    }

    // =========================================================================
    // Single Agent Execution
    // =========================================================================

    private async executeSingleAgent(
        query: string,
        targetRole: AgentRole,
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        const agent = this.agents.get(targetRole);
        
        if (!agent) {
            console.warn(`[Crew] Agent ${targetRole} not found, falling back to general`);
            const generalAgent = this.agents.get('general');
            if (!generalAgent) {
                throw new Error('No agents available');
            }
            return generalAgent.process(query, context, history);
        }

        // Track task
        const task: CrewTask = {
            id: `task-${Date.now()}`,
            description: query,
            assignedAgent: targetRole,
            status: 'running',
        };
        this.currentExecution?.tasks.push(task);

        // Execute
        const response = await agent.process(query, context, history);

        // Update task
        task.status = 'completed';
        task.result = response;

        return response;
    }

    // =========================================================================
    // Multi-Agent Execution
    // =========================================================================

    private async executeMultiAgent(
        query: string,
        agentSequence: AgentRole[],
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        switch (this.config.workflow) {
            case 'sequential':
                return this.executeSequential(query, agentSequence, context, history);
            case 'parallel':
                return this.executeParallel(query, agentSequence, context, history);
            case 'hierarchical':
                return this.executeHierarchical(query, agentSequence, context, history);
            case 'consensus':
                return this.executeConsensus(query, agentSequence, context, history);
            default:
                return this.executeSequential(query, agentSequence, context, history);
        }
    }

    /**
     * Sequential: Each agent builds on the previous one's output
     */
    private async executeSequential(
        query: string,
        agentSequence: AgentRole[],
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        let currentQuery = query;
        let allResponses: AgentResponse[] = [];
        let updatedHistory = [...history];

        for (const role of agentSequence) {
            const agent = this.agents.get(role);
            if (!agent) continue;

            const task: CrewTask = {
                id: `task-${role}-${Date.now()}`,
                description: currentQuery,
                assignedAgent: role,
                status: 'running',
            };
            this.currentExecution?.tasks.push(task);

            const response = await agent.process(currentQuery, context, updatedHistory);
            allResponses.push(response);

            // Update history with this agent's response
            updatedHistory.push({
                role: 'assistant',
                content: response.content,
                agentId: response.agentId,
            });

            // Update query for next agent (build context)
            currentQuery = `Based on the previous analysis:\n${response.content}\n\nOriginal query: ${query}\n\nPlease continue or refine this analysis.`;

            task.status = 'completed';
            task.result = response;
        }

        // Combine responses
        return this.combineResponses(allResponses, 'sequential');
    }

    /**
     * Parallel: All agents work simultaneously, results are merged
     */
    private async executeParallel(
        query: string,
        agentSequence: AgentRole[],
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        const tasks: CrewTask[] = agentSequence.map(role => ({
            id: `task-${role}-${Date.now()}`,
            description: query,
            assignedAgent: role,
            status: 'pending' as const,
        }));
        this.currentExecution?.tasks.push(...tasks);

        // Execute all agents in parallel
        const promises = agentSequence.map(async (role, index) => {
            const agent = this.agents.get(role);
            if (!agent) return null;

            tasks[index].status = 'running';
            
            try {
                const response = await agent.process(query, context, history);
                tasks[index].status = 'completed';
                tasks[index].result = response;
                return response;
            } catch (error: any) {
                tasks[index].status = 'failed';
                tasks[index].error = error.message;
                return null;
            }
        });

        const responses = await Promise.all(promises);
        const validResponses = responses.filter((r): r is AgentResponse => r !== null);

        return this.combineResponses(validResponses, 'parallel');
    }

    /**
     * Hierarchical: Router delegates, agents may sub-delegate
     */
    private async executeHierarchical(
        query: string,
        agentSequence: AgentRole[],
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        // Primary agent handles the query
        const primaryRole = agentSequence[0];
        const primaryResponse = await this.executeSingleAgent(query, primaryRole, context, history);

        // Check if primary agent suggests delegation
        if (agentSequence.length > 1 && this.shouldDelegate(primaryResponse)) {
            // Secondary agents enhance the response
            const secondaryResponses: AgentResponse[] = [primaryResponse];
            
            for (let i = 1; i < agentSequence.length; i++) {
                const role = agentSequence[i];
                const enhancementQuery = `Review and enhance this response:\n${primaryResponse.content}\n\nOriginal query: ${query}`;
                
                const enhancement = await this.executeSingleAgent(
                    enhancementQuery,
                    role,
                    context,
                    [...history, { role: 'assistant', content: primaryResponse.content }]
                );
                secondaryResponses.push(enhancement);
            }

            return this.combineResponses(secondaryResponses, 'hierarchical');
        }

        return primaryResponse;
    }

    /**
     * Consensus: Multiple agents provide responses, best one is selected
     */
    private async executeConsensus(
        query: string,
        agentSequence: AgentRole[],
        context: AgentContext,
        history: AgentMessage[]
    ): Promise<AgentResponse> {
        // Get responses from all agents
        const parallelResult = await this.executeParallel(query, agentSequence, context, history);
        
        // In a full implementation, we'd have agents vote or use another LLM to select
        // For now, we combine with clear attribution
        return parallelResult;
    }

    // =========================================================================
    // Response Combination
    // =========================================================================

    private combineResponses(
        responses: AgentResponse[],
        workflow: CrewWorkflow
    ): AgentResponse {
        if (responses.length === 0) {
            return {
                content: 'No responses generated.',
                agentId: 'crew',
                agentRole: 'general',
            };
        }

        if (responses.length === 1) {
            return responses[0];
        }

        // Combine based on workflow
        let combinedContent: string;
        const allToolsUsed = responses.flatMap(r => r.toolsUsed || []);

        switch (workflow) {
            case 'sequential':
                // Use the final response but acknowledge the chain
                combinedContent = responses[responses.length - 1].content;
                break;

            case 'parallel':
                // Merge perspectives
                combinedContent = this.mergeParallelResponses(responses);
                break;

            case 'hierarchical':
                // Primary + enhancements
                combinedContent = this.mergeHierarchicalResponses(responses);
                break;

            case 'consensus':
                // Present all viewpoints
                combinedContent = this.mergeConsensusResponses(responses);
                break;

            default:
                combinedContent = responses[0].content;
        }

        return {
            content: combinedContent,
            agentId: 'crew',
            agentRole: 'general',
            toolsUsed: [...new Set(allToolsUsed)],
            metadata: {
                reasoning: `Combined ${responses.length} agent responses using ${workflow} workflow`,
            },
        };
    }

    private mergeParallelResponses(responses: AgentResponse[]): string {
        let merged = '';
        
        responses.forEach((response, index) => {
            const agentName = AGENT_CONFIGS[response.agentRole]?.identity.name || response.agentRole;
            const emoji = AGENT_CONFIGS[response.agentRole]?.identity.avatar || '🤖';
            
            if (index > 0) merged += '\n\n---\n\n';
            merged += `**${emoji} ${agentName}:**\n${response.content}`;
        });

        return merged;
    }

    private mergeHierarchicalResponses(responses: AgentResponse[]): string {
        if (responses.length === 1) return responses[0].content;

        let merged = responses[0].content;
        
        if (responses.length > 1) {
            merged += '\n\n**Additional Insights:**\n';
            for (let i = 1; i < responses.length; i++) {
                const agentName = AGENT_CONFIGS[responses[i].agentRole]?.identity.name;
                merged += `\n*From ${agentName}:* ${responses[i].content}`;
            }
        }

        return merged;
    }

    private mergeConsensusResponses(responses: AgentResponse[]): string {
        return this.mergeParallelResponses(responses);
    }

    private shouldDelegate(response: AgentResponse): boolean {
        // Check if the response suggests need for additional expertise
        const content = response.content.toLowerCase();
        const delegationKeywords = [
            'might want to check',
            'consider consulting',
            'additional analysis',
            'further investigation',
            'data shows',
            'more research needed',
        ];
        
        return delegationKeywords.some(kw => content.includes(kw));
    }

    // =========================================================================
    // Event Handling
    // =========================================================================

    private emit(event: AgentEvent): void {
        if (this.eventHandler) {
            this.eventHandler.onEvent(event);
        }
    }

    // =========================================================================
    // Getters
    // =========================================================================

    get name(): string {
        return this.config.name;
    }

    get workflow(): CrewWorkflow {
        return this.config.workflow;
    }

    get execution(): CrewExecution | undefined {
        return this.currentExecution;
    }

    getAvailableAgents(): AgentRole[] {
        return Array.from(this.agents.keys());
    }
}

// =============================================================================
// Pre-configured Crews
// =============================================================================

export const CREW_CONFIGS: Record<string, CrewConfig> = {
    // Full capability crew with all agents
    full: {
        name: 'Full Crew',
        description: 'All specialist agents available',
        agents: ['sales', 'marketing', 'research', 'code', 'data', 'general'],
        workflow: 'hierarchical',
    },

    // Sales-focused crew
    salesTeam: {
        name: 'Sales Team',
        description: 'Optimized for sales and CRM tasks',
        agents: ['sales', 'data', 'general'],
        workflow: 'sequential',
    },

    // Marketing-focused crew
    marketingTeam: {
        name: 'Marketing Team',
        description: 'Optimized for marketing and content tasks',
        agents: ['marketing', 'research', 'general'],
        workflow: 'sequential',
    },

    // Technical crew
    techTeam: {
        name: 'Tech Team',
        description: 'Optimized for development and data tasks',
        agents: ['code', 'data', 'research', 'general'],
        workflow: 'hierarchical',
    },

    // Research crew
    researchTeam: {
        name: 'Research Team',
        description: 'Deep research and analysis',
        agents: ['research', 'data', 'general'],
        workflow: 'sequential',
    },
};

// =============================================================================
// Factory Functions
// =============================================================================

export function createCrew(configName: string): AgentCrew {
    const config = CREW_CONFIGS[configName];
    if (!config) {
        console.warn(`[Crew] Config ${configName} not found, using full crew`);
        return new AgentCrew(CREW_CONFIGS.full);
    }
    return new AgentCrew(config);
}

export function createCustomCrew(config: CrewConfig): AgentCrew {
    return new AgentCrew(config);
}

// =============================================================================
// Default Crew Instance
// =============================================================================

let defaultCrew: AgentCrew | null = null;

export function getDefaultCrew(): AgentCrew {
    if (!defaultCrew) {
        defaultCrew = createCrew('full');
    }
    return defaultCrew;
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Process a query using the default crew with memory support
 */
export async function processWithCrew(
    query: string,
    userId: string,
    conversationId: string,
    history: AgentMessage[] = [],
    options: { useMemory?: boolean; learnFromResponse?: boolean } = {}
): Promise<AgentResponse> {
    const { useMemory = true, learnFromResponse = true } = options;
    const crew = getDefaultCrew();

    // Load user's tools
    const toolkits = await loadUserToolkits(userId);
    const tools: LoadedTool[] = toolkits.flatMap(t => t.tools);

    // Build memory context if enabled
    const memory = useMemory ? await buildMemoryContext(userId, query) : undefined;

    const context: AgentContext = {
        userId,
        conversationId,
        tools,
        memory,
    };

    // Process the query
    const response = await crew.process(query, context, history);

    // Learn from the conversation if enabled
    if (learnFromResponse && response.content) {
        try {
            await learnFromConversation(
                userId,
                [
                    { role: 'user', content: query },
                    { role: 'assistant', content: response.content },
                ],
                response.agentRole
            );
        } catch (error) {
            console.warn('[Crew] Failed to learn from conversation:', error);
        }
    }

    return response;
}
