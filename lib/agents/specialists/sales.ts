// lib/agents/specialists/sales.ts
// Sales Agent - CRM, deals, pipelines, customer relationships

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class SalesAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    /**
     * Override canHandle to check for CRM tools
     */
    canHandle(query: string, context: AgentContext): boolean {
        // Check if user has any CRM-related tools
        const hasCrmTools = context.tools.some(tool => 
            ['HUBSPOT', 'SALESFORCE', 'crm'].some(cat => 
                tool.toolkit.toUpperCase().includes(cat)
            )
        );

        // Can still handle sales questions without tools (just advisory)
        const isSalesQuery = /\b(lead|deal|pipeline|crm|sales|customer|opportunity|contact|revenue|forecast)\b/i.test(query);

        return hasCrmTools || isSalesQuery;
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Filter to CRM-relevant tools
        const crmTools = tools.filter(t => 
            ['HUBSPOT', 'SALESFORCE', 'crm'].some(cat => 
                t.toolkit.toUpperCase().includes(cat)
            )
        );

        // Enhance system prompt with CRM context
        const enhancedMessages = this.enhanceWithSalesContext(messages, crmTools);

        // Call LLM
        const response = await callLLM(
            enhancedMessages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.3,
                maxTokens: this.config.maxTokens || 2000,
            },
            crmTools.length > 0 ? crmTools : undefined
        );

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, crmTools);
            toolsUsed.push(...toolResults.toolsUsed);

            // Follow-up with tool results
            const followUpMessages: AgentMessage[] = [
                ...enhancedMessages,
                { role: 'assistant', content: response.content || '', toolCalls: response.toolCalls },
                { role: 'tool', content: toolResults.summary },
            ];

            const finalResponse = await callLLM(
                followUpMessages,
                {
                    model: this.config.model || 'gpt-4o-mini',
                    temperature: this.config.temperature || 0.3,
                    maxTokens: this.config.maxTokens || 2000,
                }
            );

            return this.createResponse(
                finalResponse.content,
                { tokens: finalResponse.usage, model: this.config.model },
                toolsUsed
            );
        }

        return this.createResponse(
            response.content,
            { tokens: response.usage, model: this.config.model },
            toolsUsed
        );
    }

    private enhanceWithSalesContext(messages: AgentMessage[], tools: LoadedTool[]): AgentMessage[] {
        const salesContext = `
## Sales Context

You have access to ${tools.length} CRM tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When discussing sales metrics, always try to:
1. Provide specific numbers when available
2. Compare to previous periods if relevant
3. Suggest actionable next steps
4. Identify at-risk deals or opportunities
`;

        return messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return { ...msg, content: msg.content + salesContext };
            }
            return msg;
        });
    }

    private async executeToolCalls(
        toolCalls: { id: string; name: string; arguments: Record<string, any> }[],
        tools: LoadedTool[]
    ): Promise<{ toolsUsed: string[]; summary: string }> {
        const toolsUsed: string[] = [];
        const results: string[] = [];

        for (const call of toolCalls) {
            const tool = tools.find(t => t.name === call.name);
            if (tool) {
                const result = await this.executeTool(tool, call.arguments);
                toolsUsed.push(tool.name);
                
                if (result.error) {
                    results.push(`${tool.name}: Error - ${result.error}`);
                } else {
                    results.push(`${tool.name}: ${JSON.stringify(result.result)}`);
                }
            }
        }

        return { toolsUsed, summary: results.join('\n\n') };
    }
}
