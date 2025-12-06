// lib/agents/specialists/code.ts
// Code Agent - Development, debugging, code review, technical tasks

import { BaseAgent, callLLM } from '../base';
import { AgentConfig, AgentContext, AgentMessage, AgentResponse } from '../types';
import { LoadedTool } from '@/lib/tools/dynamic-loader';

export class CodeAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    canHandle(query: string, context: AgentContext): boolean {
        const hasCodeTools = context.tools.some(tool => 
            ['GITHUB', 'development', 'code'].some(cat => 
                tool.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        const isCodeQuery = /\b(code|function|class|bug|debug|error|fix|implement|develop|programming|api|script|variable|loop|array|object|database|sql|query|git|commit|merge|deploy)\b/i.test(query);

        // Also check for code blocks or technical patterns
        const hasCodePatterns = /```|function\s*\(|const\s+\w+|let\s+\w+|var\s+\w+|import\s+|export\s+|class\s+\w+|def\s+\w+|public\s+|private\s+/.test(query);

        return hasCodeTools || isCodeQuery || hasCodePatterns;
    }

    protected async execute(
        messages: AgentMessage[],
        tools: LoadedTool[],
        context: AgentContext
    ): Promise<AgentResponse> {
        const toolsUsed: string[] = [];

        // Filter to code-relevant tools
        const codeTools = tools.filter(t => 
            ['GITHUB', 'development', 'code'].some(cat => 
                t.toolkit.toUpperCase().includes(cat.toUpperCase())
            )
        );

        // Enhance with coding context
        const enhancedMessages = this.enhanceWithCodeContext(messages);

        const response = await callLLM(
            enhancedMessages,
            {
                model: this.config.model || 'gpt-4o-mini',
                temperature: this.config.temperature || 0.2,
                maxTokens: this.config.maxTokens || 4000,
            },
            codeTools.length > 0 ? codeTools : undefined
        );

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolResults = await this.executeToolCalls(response.toolCalls, codeTools);
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
                    temperature: this.config.temperature || 0.2,
                    maxTokens: this.config.maxTokens || 4000,
                }
            );

            return this.createResponse(
                this.formatCodeResponse(finalResponse.content),
                { tokens: finalResponse.usage, model: this.config.model },
                toolsUsed
            );
        }

        return this.createResponse(
            this.formatCodeResponse(response.content),
            { tokens: response.usage, model: this.config.model },
            toolsUsed
        );
    }

    private enhanceWithCodeContext(messages: AgentMessage[]): AgentMessage[] {
        const codeContext = `
## Code Guidelines

When writing or reviewing code:

### Best Practices
- Write clean, readable code with meaningful names
- Follow the language's conventions and style guides
- Handle errors gracefully with try/catch
- Add comments for complex logic
- Keep functions small and focused

### Response Format
When providing code:
1. Explain the approach briefly
2. Provide the code in proper markdown code blocks
3. Include language identifier (e.g., \`\`\`typescript)
4. Add inline comments for key sections
5. Explain any edge cases or considerations

### Debugging
When debugging:
1. Identify the error type and location
2. Explain the root cause
3. Provide the fix with explanation
4. Suggest preventive measures

### Security
- Never expose secrets or API keys
- Validate and sanitize inputs
- Use parameterized queries for databases
- Follow OWASP guidelines
`;

        return messages.map((msg, index) => {
            if (index === 0 && msg.role === 'system') {
                return { ...msg, content: msg.content + codeContext };
            }
            return msg;
        });
    }

    private formatCodeResponse(content: string): string {
        // Ensure code blocks are properly formatted
        // Add language hints if missing
        return content.replace(/```(\s*\n)/g, '```typescript$1');
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
