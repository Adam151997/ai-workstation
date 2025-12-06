// lib/agents/router.ts
// Router Agent - Intelligent query classification and routing

import { BaseAgent, callLLM } from './base';
import { 
    AgentConfig, 
    AgentContext, 
    AgentMessage, 
    AgentResponse,
    AgentRole,
    RoutingDecision,
    RoutingContext,
} from './types';
import { AGENT_CONFIGS, getAgentByKeywords } from './configs';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

// =============================================================================
// Router Agent
// =============================================================================

export class RouterAgent extends BaseAgent {
    constructor(config?: AgentConfig) {
        super(config || AGENT_CONFIGS.router);
    }

    /**
     * Route a query to the appropriate specialist agent
     */
    async route(
        query: string,
        context: RoutingContext
    ): Promise<RoutingDecision> {
        // Fast path: Use keyword matching for obvious cases
        const keywordMatch = this.tryKeywordRouting(query, context);
        if (keywordMatch && keywordMatch.confidence > 0.8) {
            return keywordMatch;
        }

        // Use LLM for complex routing decisions
        const llmDecision = await this.routeWithLLM(query, context);
        
        // Validate the decision
        return this.validateDecision(llmDecision, context);
    }

    /**
     * Quick routing based on keyword patterns
     */
    private tryKeywordRouting(query: string, context: RoutingContext): RoutingDecision | null {
        const role = getAgentByKeywords(query);
        
        // Check if user has relevant tools for the detected role
        const hasRelevantTools = this.checkToolsForRole(role, context.userToolkits);
        
        if (role !== 'general') {
            return {
                targetAgent: role,
                confidence: hasRelevantTools ? 0.85 : 0.7,
                reasoning: `Query matches ${role} keywords${hasRelevantTools ? ' and user has relevant tools' : ''}`,
                requiresMultiAgent: false,
            };
        }

        return null;
    }

    /**
     * Use LLM for complex routing decisions
     */
    private async routeWithLLM(query: string, context: RoutingContext): Promise<RoutingDecision> {
        const routingPrompt = this.buildRoutingPrompt(query, context);

        const response = await callLLM(
            [
                { role: 'system', content: this.config.systemPrompt },
                { role: 'user', content: routingPrompt },
            ],
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: 0.1,
                maxTokens: 500,
            }
        );

        return this.parseRoutingResponse(response.content);
    }

    /**
     * Build the routing prompt with context
     */
    private buildRoutingPrompt(query: string, context: RoutingContext): string {
        let prompt = `## User Query\n${query}\n\n`;

        // Add conversation context
        if (context.conversationHistory.length > 0) {
            prompt += `## Recent Conversation\n`;
            const recentMessages = context.conversationHistory.slice(-3);
            recentMessages.forEach(msg => {
                prompt += `${msg.role}: ${msg.content.substring(0, 200)}...\n`;
            });
            prompt += '\n';
        }

        // Add available tools context
        if (context.userToolkits.length > 0) {
            prompt += `## User's Connected Tools\n`;
            prompt += context.userToolkits.join(', ');
            prompt += '\n\n';
        }

        // Add available agents
        prompt += `## Available Agents\n`;
        context.availableAgents.forEach(agent => {
            if (agent !== 'router') {
                const config = AGENT_CONFIGS[agent];
                prompt += `- ${agent}: ${config.identity.description}\n`;
            }
        });

        prompt += `\n## Task\nAnalyze the query and determine which agent should handle it. Respond ONLY with a JSON object.`;

        return prompt;
    }

    /**
     * Parse the LLM response into a RoutingDecision
     */
    private parseRoutingResponse(response: string): RoutingDecision {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                targetAgent: parsed.targetAgent || 'general',
                confidence: parsed.confidence || 0.5,
                reasoning: parsed.reasoning || 'No reasoning provided',
                requiresMultiAgent: parsed.requiresMultiAgent || false,
                agentSequence: parsed.agentSequence,
                suggestedTools: parsed.suggestedTools,
            };
        } catch (error) {
            console.error('[Router] Failed to parse routing response:', error);
            return {
                targetAgent: 'general',
                confidence: 0.3,
                reasoning: 'Failed to parse routing decision, defaulting to general',
                requiresMultiAgent: false,
            };
        }
    }

    /**
     * Validate and adjust the routing decision
     */
    private validateDecision(decision: RoutingDecision, context: RoutingContext): RoutingDecision {
        // Ensure target agent is available
        if (!context.availableAgents.includes(decision.targetAgent)) {
            return {
                ...decision,
                targetAgent: 'general',
                confidence: decision.confidence * 0.5,
                reasoning: `${decision.reasoning} (original target unavailable, falling back to general)`,
            };
        }

        // Boost confidence if user has relevant tools
        if (this.checkToolsForRole(decision.targetAgent, context.userToolkits)) {
            return {
                ...decision,
                confidence: Math.min(1, decision.confidence + 0.1),
            };
        }

        return decision;
    }

    /**
     * Check if user has tools relevant to a specific agent role
     */
    private checkToolsForRole(role: AgentRole, userToolkits: string[]): boolean {
        const toolMappings: Record<AgentRole, string[]> = {
            sales: ['HUBSPOT', 'SALESFORCE', 'CRM'],
            marketing: ['MAILCHIMP', 'LINKEDIN', 'TWITTER', 'SOCIAL'],
            research: ['WEB', 'SEARCH', 'GOOGLE'],
            code: ['GITHUB', 'CODE'],
            data: ['AIRTABLE', 'SHEETS', 'ANALYTICS', 'GOOGLE_DRIVE'],
            general: [],
            router: [],
        };

        const relevantTools = toolMappings[role] || [];
        return userToolkits.some(toolkit => 
            relevantTools.some(tool => 
                toolkit.toUpperCase().includes(tool)
            )
        );
    }

    /**
     * Required by BaseAgent but not used for routing
     */
    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        // Router doesn't execute queries directly
        // It just routes to other agents
        return this.createResponse(
            'I am the router agent. I analyze queries and route them to specialist agents.',
            { reasoning: 'Router agent does not process queries directly' }
        );
    }
}

// =============================================================================
// Singleton Router Instance
// =============================================================================

let routerInstance: RouterAgent | null = null;

export function getRouter(): RouterAgent {
    if (!routerInstance) {
        routerInstance = new RouterAgent();
    }
    return routerInstance;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick route function for simple cases
 */
export async function routeQuery(
    query: string,
    userToolkits: string[] = [],
    conversationHistory: AgentMessage[] = []
): Promise<RoutingDecision> {
    const router = getRouter();
    
    const context: RoutingContext = {
        query,
        conversationHistory,
        availableAgents: ['sales', 'marketing', 'research', 'code', 'data', 'general'],
        userToolkits,
    };

    return router.route(query, context);
}

/**
 * Simple keyword-only routing (no LLM call)
 */
export function quickRoute(query: string): AgentRole {
    return getAgentByKeywords(query);
}
