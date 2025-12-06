// lib/agents/specialists/marketing.ts
// Marketing Agent - Campaigns, content, social media, email marketing

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class MarketingAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    canHandle(query: string, context: AgentContext): boolean {
        const hasMarketingTools = context.tools.some(tool => 
            ['MAILCHIMP', 'LINKEDIN', 'TWITTER', 'marketing', 'social', 'email'].some(cat => 
                tool.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        const isMarketingQuery = /\b(campaign|marketing|social|content|email|newsletter|audience|brand|ads?|advertising|engagement|followers?)\b/i.test(query);

        return hasMarketingTools || isMarketingQuery;
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Filter to marketing-relevant tools
        const marketingTools = tools.filter(t => 
            ['MAILCHIMP', 'LINKEDIN', 'TWITTER', 'marketing', 'social', 'email'].some(cat => 
                t.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        // Enhance with marketing context
        const enhancedMessages = this.enhanceWithMarketingContext(messages, marketingTools);

        const response = await callLLM(
            enhancedMessages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.5,
                maxTokens: this.config.maxTokens || 2000,
            },
            marketingTools.length > 0 ? marketingTools : undefined
        );

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, marketingTools);
            toolsUsed.push(...toolResults.toolsUsed);

            const followUpMessages: AgentMessage[] = [
                ...enhancedMessages,
                { role: 'assistant', content: response.content || '', toolCalls: response.toolCalls },
                { role: 'tool', content: toolResults.summary },
            ];

            const finalResponse = await callLLM(
                followUpMessages,
                {
                    model: this.config.model || 'gpt-4o-mini',
                    temperature: this.config.temperature || 0.5,
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

    private enhanceWithMarketingContext(messages: AgentMessage[], tools: LoadedTool[]): AgentMessage[] {
        const marketingContext = `
## Marketing Context

You have access to ${tools.length} marketing tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When creating marketing content:
1. Consider the target audience
2. Suggest appropriate channels
3. Include calls-to-action
4. Think about timing and frequency
5. Recommend A/B testing opportunities
`;

        return messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return { ...msg, content: msg.content + marketingContext };
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
                results.push(result.error 
                    ? `${tool.name}: Error - ${result.error}`
                    : `${tool.name}: ${JSON.stringify(result.result)}`
                );
            }
        }

        return { toolsUsed, summary: results.join('\n\n') };
    }
}
