// lib/agents/specialists/research.ts
// Research Agent - Web research, information gathering, analysis

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class ResearchAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    canHandle(query: string, context: AgentContext): boolean {
        // Research agent can always handle queries - it's a generalist researcher
        const isResearchQuery = /\b(research|search|find|look\s*up|investigate|analyze|compare|study|report|information|what\s+is|who\s+is|how\s+does|why\s+does)\b/i.test(query);
        return isResearchQuery;
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Filter to research-relevant tools (web, documents, etc.)
        const researchTools = tools.filter(t => 
            ['web', 'search', 'research', 'documents', 'GOOGLE_DRIVE'].some(cat => 
                t.toolkit.toLowerCase().includes(cat.toLowerCase())
            )
        );

        // Enhance with research methodology
        const enhancedMessages = this.enhanceWithResearchContext(messages);

        const response = await callLLM(
            enhancedMessages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.2,
                maxTokens: this.config.maxTokens || 3000,
            },
            researchTools.length > 0 ? researchTools : undefined
        );

        // Handle tool calls (web searches, document reads)
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, researchTools);
            toolsUsed.push(...toolResults.toolsUsed);

            // Synthesize findings
            const followUpMessages: AgentMessage[] = [
                ...enhancedMessages,
                { role: 'assistant', content: response.content || '', toolCalls: response.toolCalls },
                { role: 'tool', content: toolResults.summary },
                { role: 'user', content: 'Please synthesize these findings into a clear, well-organized response. Cite sources where relevant.' },
            ];

            const finalResponse = await callLLM(
                followUpMessages,
                {
                    model: this.config.model || 'gpt-4o-mini',
                    temperature: this.config.temperature || 0.2,
                    maxTokens: this.config.maxTokens || 3000,
                }
            );

            return this.createResponse(
                finalResponse.content,
                { 
                    tokens: finalResponse.usage, 
                    model: this.config.model,
                    sources: toolResults.sources,
                },
                toolsUsed
            );
        }

        return this.createResponse(
            response.content,
            { tokens: response.usage, model: this.config.model },
            toolsUsed
        );
    }

    private enhanceWithResearchContext(messages: AgentMessage[]): AgentMessage[] {
        const researchContext = `
## Research Methodology

When conducting research:
1. **Clarify the question** - Make sure you understand what's being asked
2. **Gather information** - Use available tools to find relevant data
3. **Verify sources** - Cross-reference when possible
4. **Synthesize findings** - Present information clearly and logically
5. **Cite sources** - Always attribute information to its source
6. **Note limitations** - Be clear about what you couldn't find or verify

## Response Format

Structure your research findings:
- **Summary**: Brief overview of key findings
- **Details**: Organized presentation of information
- **Sources**: List of sources consulted
- **Caveats**: Any limitations or uncertainties
`;

        return messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return { ...msg, content: msg.content + researchContext };
            }
            return msg;
        });
    }

    private async executeToolCalls(
        toolCalls: { id: string; name: string; arguments: Record<string, any> }[],
        tools: LoadedTool[]
    ): Promise<{ toolsUsed: string[]; summary: string; sources: string[] }> {
        const toolsUsed: string[] = [];
        const results: string[] = [];
        const sources: string[] = [];

        for (const call of toolCalls) {
            const tool = tools.find(t => t.name === call.name);
            if (tool) {
                const result = await this.executeTool(tool, call.arguments);
                toolsUsed.push(tool.name);
                
                if (result.error) {
                    results.push(`${tool.name}: Error - ${result.error}`);
                } else {
                    results.push(`${tool.name}: ${JSON.stringify(result.result)}`);
                    // Track sources
                    if (call.arguments.url) sources.push(call.arguments.url);
                    if (call.arguments.query) sources.push(`Search: ${call.arguments.query}`);
                }
            }
        }

        return { toolsUsed, summary: results.join('\n\n'), sources };
    }
}
