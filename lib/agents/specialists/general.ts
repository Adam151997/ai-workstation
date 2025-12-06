// lib/agents/specialists/general.ts
// General Agent - Versatile assistant for general queries

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class GeneralAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Call LLM with available tools
        const response = await callLLM(
            messages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.7,
                maxTokens: this.config.maxTokens || 2000,
            },
            tools
        );

        // Handle tool calls if any
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults: string[] = [];

            for (const toolCall of response.toolCalls) {
                const tool = tools.find(t => t.name === toolCall.name);
                if (tool) {
                    const result = await this.executeTool(tool, toolCall.arguments);
                    toolsUsed.push(tool.name);
                    
                    if (result.error) {
                        toolResults.push(`${tool.name}: Error - ${result.error}`);
                    } else {
                        toolResults.push(`${tool.name}: ${JSON.stringify(result.result)}`);
                    }
                }
            }

            // Call LLM again with tool results
            const followUpMessages: AgentMessage[] = [
                ...messages,
                {
                    role: 'assistant',
                    content: response.content || 'I\'ll help you with that.',
                    toolCalls: response.toolCalls,
                },
                {
                    role: 'tool',
                    content: toolResults.join('\n\n'),
                },
            ];

            const finalResponse = await callLLM(
                followUpMessages,
                {
                    model: this.config.model || 'gpt-4o-mini',
                    temperature: this.config.temperature || 0.7,
                    maxTokens: this.config.maxTokens || 2000,
                }
            );

            return this.createResponse(
                finalResponse.content,
                {
                    tokens: finalResponse.usage,
                    model: this.config.model,
                },
                toolsUsed
            );
        }

        return this.createResponse(
            response.content,
            {
                tokens: response.usage,
                model: this.config.model,
            },
            toolsUsed
        );
    }
}
