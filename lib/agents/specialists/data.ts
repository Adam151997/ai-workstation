// lib/agents/specialists/data.ts
// Data Agent - Analytics, visualization, spreadsheets, data processing

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class DataAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    canHandle(query: string, context: AgentContext): boolean {
        const hasDataTools = context.tools.some(tool => 
            ['AIRTABLE', 'GOOGLE_SHEETS', 'analytics', 'storage', 'data'].some(cat => 
                tool.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        const isDataQuery = /\b(data|chart|graph|visuali[sz]e|spreadsheet|metrics|dashboard|report|analyze|statistics|csv|excel|table|column|row|aggregate|sum|average|count|pivot)\b/i.test(query);

        return hasDataTools || isDataQuery;
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Filter to data-relevant tools
        const dataTools = tools.filter(t => 
            ['AIRTABLE', 'GOOGLE_SHEETS', 'GOOGLE_DRIVE', 'analytics', 'storage', 'data'].some(cat => 
                t.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        // Enhance with data analysis context
        const enhancedMessages = this.enhanceWithDataContext(messages, dataTools);

        const response = await callLLM(
            enhancedMessages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.3,
                maxTokens: this.config.maxTokens || 3000,
            },
            dataTools.length > 0 ? dataTools : undefined
        );

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, dataTools);
            toolsUsed.push(...toolResults.toolsUsed);

            // Analyze the data results
            const followUpMessages: AgentMessage[] = [
                ...enhancedMessages,
                { role: 'assistant', content: response.content || '', toolCalls: response.toolCalls },
                { role: 'tool', content: toolResults.summary },
                { role: 'user', content: 'Based on this data, provide insights and recommendations. If visualization would help, describe what chart type would be best.' },
            ];

            const finalResponse = await callLLM(
                followUpMessages,
                {
                    model: this.config.model || 'gpt-4o-mini',
                    temperature: this.config.temperature || 0.3,
                    maxTokens: this.config.maxTokens || 3000,
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

    private enhanceWithDataContext(messages: AgentMessage[], tools: LoadedTool[]): AgentMessage[] {
        const dataContext = `
## Data Analysis Context

You have access to ${tools.length} data tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

### Analysis Guidelines

1. **Understand the Data**
   - What type of data is it?
   - What's the structure (columns, rows, types)?
   - Are there any quality issues?

2. **Choose the Right Analysis**
   - Descriptive: summarize what's in the data
   - Diagnostic: explain why something happened
   - Predictive: forecast what might happen
   - Prescriptive: recommend actions

3. **Visualization Best Practices**
   - Bar charts: comparing categories
   - Line charts: trends over time
   - Scatter plots: relationships between variables
   - Pie charts: parts of a whole (use sparingly)
   - Tables: detailed comparisons

4. **Insight Format**
   - Lead with the key insight
   - Support with specific numbers
   - Explain the "so what"
   - Recommend next steps

### Statistical Concepts
When relevant, apply:
- Mean, median, mode for central tendency
- Standard deviation for spread
- Correlation for relationships
- Growth rates for trends
`;

        return messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return { ...msg, content: msg.content + dataContext };
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
                    // Format data results nicely
                    const formatted = this.formatDataResult(result.result);
                    results.push(`${tool.name}:\n${formatted}`);
                }
            }
        }

        return { toolsUsed, summary: results.join('\n\n') };
    }

    private formatDataResult(result: any): string {
        if (Array.isArray(result)) {
            // Format as table if it's an array of objects
            if (result.length > 0 && typeof result[0] === 'object') {
                const headers = Object.keys(result[0]);
                const rows = result.slice(0, 10).map(row => 
                    headers.map(h => String(row[h] || '')).join(' | ')
                );
                return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(r => `| ${r} |`).join('\n')}${result.length > 10 ? `\n... and ${result.length - 10} more rows` : ''}`;
            }
            return result.slice(0, 10).join(', ') + (result.length > 10 ? ` ... (${result.length} total)` : '');
        }
        return JSON.stringify(result, null, 2);
    }
}
