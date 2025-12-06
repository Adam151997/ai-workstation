// app/api/chat/route.ts - WITH RAG + DYNAMIC TOOLKIT + MULTI-AGENT SYSTEM
import { groq } from '@ai-sdk/groq';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { auth } from "@clerk/nextjs/server";
import { MODES_CONFIG, type Mode } from '@/config/modes';
import { DEFAULT_MODEL, getModelInfo } from '@/config/ai-models';
import { ComposioMCPClient } from '@/lib/composio-mcp-dynamic';
import { getRAGContext, injectRAGContext } from '@/lib/rag-helper';
import { getUserToolSlugs } from '@/app/actions/tools';
import { logChatAction } from '@/lib/audit';
import { trackSimpleUsage, checkUserRateLimits } from '@/lib/billing/usage-tracker';
import { CoreMessage } from 'ai';
import { z } from 'zod';

// Agent System Imports
import {
    processWithCrew,
    routeQuery,
    quickRoute,
    AGENT_CONFIGS,
    AgentMessage,
} from '@/lib/agents';

export const maxDuration = 60;

// Feature flags
const ENABLE_TOOLS = true;
const ENABLE_RAG = true;
const ENABLE_AGENT_MODE = true; // New: Multi-agent routing

// ✅ FIX: Convert MCP JSON Schema to Zod schema dynamically
function jsonSchemaToZod(schema: any): z.ZodTypeAny {
    if (!schema || !schema.type) {
        return z.any();
    }

    switch (schema.type) {
        case 'string':
            let stringSchema = z.string();
            if (schema.description) {
                stringSchema = stringSchema.describe(schema.description);
            }
            return stringSchema;

        case 'number':
        case 'integer':
            let numberSchema = z.number();
            if (schema.description) {
                numberSchema = numberSchema.describe(schema.description);
            }
            return numberSchema;

        case 'boolean':
            let boolSchema = z.boolean();
            if (schema.description) {
                boolSchema = boolSchema.describe(schema.description);
            }
            return boolSchema;

        case 'array':
            const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
            let arraySchema = z.array(itemSchema);
            if (schema.description) {
                arraySchema = arraySchema.describe(schema.description);
            }
            return arraySchema;

        case 'object':
            if (!schema.properties || Object.keys(schema.properties).length === 0) {
                return z.object({}).passthrough();
            }

            const shape: Record<string, z.ZodTypeAny> = {};
            const required = schema.required || [];

            for (const [key, propSchema] of Object.entries(schema.properties)) {
                let propZod = jsonSchemaToZod(propSchema as any);
                
                if (!required.includes(key)) {
                    propZod = propZod.optional();
                }
                
                shape[key] = propZod;
            }

            return z.object(shape);

        default:
            if (typeof schema.type === 'string' && schema.type.includes(',')) {
                const types = schema.type.split(',').map((t: string) => t.trim());
                const primaryType = types.find((t: string) => t !== 'null') || 'string';
                return jsonSchemaToZod({ ...schema, type: primaryType });
            }
            return z.any();
    }
}

// ✅ Clean JSON Schema for conversion
function cleanJsonSchema(inputSchema: any): any {
    if (!inputSchema) {
        return { type: 'object', properties: {} };
    }

    const schema = JSON.parse(JSON.stringify(inputSchema));

    if (!schema.type) {
        schema.type = 'object';
    }

    if (!schema.properties) {
        schema.properties = {};
    }

    if (schema.properties) {
        for (const key in schema.properties) {
            const prop = schema.properties[key];
            delete prop.default;
            
            if (typeof prop.type === 'string' && prop.type.includes(',')) {
                const types = prop.type.split(',').map((t: string) => t.trim());
                prop.type = types.find((t: string) => t !== 'null') || 'string';
            }
            
            if (prop.type === 'undefined') {
                prop.type = 'string';
            }

            if (!prop.type) {
                prop.type = 'string';
            }

            if (prop.type === 'array' && prop.items) {
                delete prop.items.default;
                if (!prop.items.type) {
                    prop.items.type = 'string';
                }
            }
        }
    }

    delete schema.$schema;
    return schema;
}

// Get the appropriate model instance based on provider
function getModelInstance(modelId: string) {
    const modelInfo = getModelInfo(modelId);

    if (!modelInfo) {
        console.warn(`[Agent] Unknown model: ${modelId}, falling back to default`);
        return groq(DEFAULT_MODEL);
    }

    switch (modelInfo.provider) {
        case 'groq':
            return groq(modelId);
        case 'openai':
            return openai.chat(modelId);
        default:
            console.warn(`[Agent] Unknown provider: ${modelInfo.provider}`);
            return groq(DEFAULT_MODEL);
    }
}

// Convert messages to agent format
function toAgentMessages(messages: CoreMessage[]): AgentMessage[] {
    return messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));
}

export async function POST(req: Request) {
    const startTime = Date.now();
    
    try {
        const { userId } = await auth();
        if (!userId) {
            return new Response("Unauthorized", { status: 401 });
        }

        // ============================================
        // RATE LIMIT CHECK
        // ============================================
        try {
            const rateLimitStatus = await checkUserRateLimits(userId);
            if (!rateLimitStatus.allowed) {
                console.log(`[Agent] ⚠️ Rate limited: ${rateLimitStatus.reason}`);
                return new Response(
                    JSON.stringify({
                        error: 'Rate limit exceeded',
                        message: rateLimitStatus.reason,
                        resetAt: rateLimitStatus.resetAt?.toISOString(),
                    }),
                    { 
                        status: 429, 
                        headers: { 'Content-Type': 'application/json' } 
                    }
                );
            }
        } catch (rateLimitError) {
            console.error('[Agent] Rate limit check failed:', rateLimitError);
        }

        const { 
            messages, 
            selectedMode, 
            selectedModel, 
            requestArtifact,
            useAgentMode,        // New: Enable multi-agent routing
            conversationId,      // New: For memory context
        } = await req.json();

        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage?.content?.toLowerCase() || '';
        const originalMessage = lastMessage?.content || '';

        // ============================================
        // ARTIFACT DETECTION & GENERATION
        // ============================================

        const isDocumentRequest =
            userMessage.includes('create a document') ||
            userMessage.includes('generate a document') ||
            userMessage.includes('write a document') ||
            userMessage.includes('create a report') ||
            userMessage.includes('generate a report') ||
            userMessage.includes('write a report') ||
            userMessage.includes('create a proposal') ||
            userMessage.includes('write a proposal') ||
            (userMessage.includes('document') && (userMessage.includes('create') || userMessage.includes('generate') || userMessage.includes('write')));

        const isTableRequest =
            userMessage.includes('create a table') ||
            userMessage.includes('generate a table') ||
            userMessage.includes('create a list') ||
            userMessage.includes('generate a list') ||
            userMessage.includes('create a spreadsheet') ||
            (userMessage.includes('table') && (userMessage.includes('create') || userMessage.includes('generate')));

        const isChartRequest =
            userMessage.includes('create a chart') ||
            userMessage.includes('generate a chart') ||
            userMessage.includes('create a graph') ||
            userMessage.includes('generate a graph') ||
            userMessage.includes('visualize') ||
            userMessage.includes('show me a chart') ||
            userMessage.includes('show me a graph') ||
            (userMessage.includes('chart') && (userMessage.includes('create') || userMessage.includes('generate') || userMessage.includes('show'))) ||
            (userMessage.includes('graph') && (userMessage.includes('create') || userMessage.includes('generate') || userMessage.includes('show')));

        if (requestArtifact || isDocumentRequest || isTableRequest || isChartRequest) {
            console.log(`[Artifact] 🎨 Artifact request detected!`);

            const { generateDocumentArtifact, generateTableArtifact, generateChartArtifact } = await import('@/app/actions/artifacts');

            let artifactType = requestArtifact || 'document';
            let artifactStream;

            if (!requestArtifact) {
                if (isChartRequest) {
                    artifactType = 'chart';
                } else if (isTableRequest) {
                    artifactType = 'table';
                } else {
                    artifactType = 'document';
                }
            }

            switch (artifactType) {
                case 'chart':
                    artifactStream = await generateChartArtifact(userMessage);
                    break;
                case 'table':
                    artifactStream = await generateTableArtifact(userMessage);
                    break;
                default:
                    artifactStream = await generateDocumentArtifact(userMessage);
            }

            return new Response(
                JSON.stringify({
                    type: 'artifact',
                    artifactType,
                    streamValue: artifactStream.object
                }),
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        // ============================================
        // MULTI-AGENT MODE (NEW!)
        // ============================================

        if (ENABLE_AGENT_MODE && useAgentMode) {
            console.log(`[Agent] 🤖 Multi-agent mode enabled`);

            try {
                // Get user's toolkits for routing context
                const userToolSlugs = await getUserToolSlugs(userId);
                
                // Quick route to determine which agent
                const routing = await routeQuery(originalMessage, userToolSlugs, toAgentMessages(messages));
                
                console.log(`[Agent] 🧭 Routing decision: ${routing.targetAgent} (confidence: ${routing.confidence})`);
                console.log(`[Agent] 💭 Reasoning: ${routing.reasoning}`);

                // Get agent info for UI
                const agentConfig = AGENT_CONFIGS[routing.targetAgent];
                const agentInfo = {
                    id: agentConfig.identity.id,
                    name: agentConfig.identity.name,
                    avatar: agentConfig.identity.avatar,
                    color: agentConfig.identity.color,
                };

                // Process with the crew (includes memory)
                const agentResponse = await processWithCrew(
                    originalMessage,
                    userId,
                    conversationId || `conv-${Date.now()}`,
                    toAgentMessages(messages.slice(0, -1)), // Exclude current message
                    { useMemory: true, learnFromResponse: true }
                );

                console.log(`[Agent] ✅ Agent response received (${agentResponse.content.length} chars)`);

                // Track usage
                const durationMs = Date.now() - startTime;
                trackSimpleUsage({
                    userId,
                    usageType: 'chat',
                    tokensInput: Math.ceil(originalMessage.length / 4),
                    tokensOutput: Math.ceil(agentResponse.content.length / 4),
                    modelId: 'gpt-4o-mini', // Agent uses this internally
                    mode: selectedMode || 'Sales',
                    durationMs,
                    success: true,
                    metadata: {
                        agentMode: true,
                        agent: routing.targetAgent,
                        confidence: routing.confidence,
                        toolsUsed: agentResponse.toolsUsed?.length || 0,
                    },
                }).catch(err => console.error('[Agent] Usage tracking error:', err));

                // Return agent response with metadata
                return new Response(
                    JSON.stringify({
                        type: 'agent',
                        content: agentResponse.content,
                        agent: agentInfo,
                        routing: {
                            targetAgent: routing.targetAgent,
                            confidence: routing.confidence,
                            reasoning: routing.reasoning,
                        },
                        toolsUsed: agentResponse.toolsUsed,
                        metadata: agentResponse.metadata,
                    }),
                    {
                        headers: { 'Content-Type': 'application/json' }
                    }
                );

            } catch (agentError) {
                console.error('[Agent] ❌ Multi-agent error:', agentError);
                // Fall through to regular chat flow
                console.log('[Agent] Falling back to regular chat...');
            }
        }

        // ============================================
        // REGULAR CHAT FLOW (existing implementation)
        // ============================================

        const modeKey = (selectedMode as Mode) || 'Sales';
        const modeConfig = MODES_CONFIG[modeKey];
        const modelId = selectedModel || DEFAULT_MODEL;
        const modelInfo = getModelInfo(modelId);

        console.log(`[Agent] Mode: ${modeKey}, Model: ${modelId} (${modelInfo?.provider || 'unknown'})`);

        // ============================================
        // DYNAMIC USER TOOLKIT LOADING
        // ============================================

        console.log('[Toolkit] 🔧 Loading user\'s personalized toolkit...');
        const userToolSlugs = await getUserToolSlugs(userId);
        console.log(`[Toolkit] ✅ User has ${userToolSlugs.length} tools enabled`);

        // ============================================
        // RAG CONTEXT RETRIEVAL
        // ============================================

        let enhancedSystemPrompt = modeConfig.systemPrompt;
        let ragSources: any[] = [];

        if (ENABLE_RAG && lastMessage?.content) {
            try {
                console.log('[RAG] 🔍 Searching documents...');
                const ragContext = await getRAGContext(
                    lastMessage.content,
                    userId,
                    modeKey,
                    { topK: 3 }
                );

                if (ragContext.hasContext) {
                    console.log(`[RAG] ✅ Found ${ragContext.sources.length} relevant chunks`);
                    enhancedSystemPrompt = injectRAGContext(modeConfig.systemPrompt, ragContext.context);
                    ragSources = ragContext.sources;
                }
            } catch (ragError) {
                console.error('[RAG] ⚠️ Error retrieving context:', ragError);
            }
        }

        // Build tools using Zod schemas
        const aiTools: Record<string, any> = {};
        let mcpClientRef: ComposioMCPClient | null = null;
        const supportsTools = modelInfo?.supportsTools ?? true;
        const enableToolsForThisRequest = ENABLE_TOOLS && supportsTools;

        if (enableToolsForThisRequest) {
            const mcpClient = new ComposioMCPClient(modeKey, userId, userToolSlugs);
            mcpClientRef = mcpClient;

            try {
                const mcpTools = await mcpClient.getTools();

                if (mcpTools.length > 0) {
                    const MAX_TOOLS = 128;
                    let limitedTools = mcpTools.slice(0, MAX_TOOLS);

                    console.log(`[Agent] 📦 Loading ${limitedTools.length} tools...`);

                    let successfullyLoaded = 0;

                    for (const mcpTool of limitedTools) {
                        try {
                            const hasProperties = mcpTool.inputSchema?.properties &&
                                Object.keys(mcpTool.inputSchema.properties).length > 0;

                            if (!hasProperties) continue;

                            const cleanedSchema = cleanJsonSchema(mcpTool.inputSchema);
                            const zodSchema = jsonSchemaToZod(cleanedSchema);
                            const toolName = mcpTool.name;

                            aiTools[toolName] = {
                                description: mcpTool.description || `Execute ${toolName}`,
                                inputSchema: zodSchema,
                                execute: async (args: Record<string, any>) => {
                                    console.log(`[Agent] 🔧 Executing: ${toolName}`);
                                    try {
                                        const result = await mcpClient.executeTool(toolName, args);
                                        return { success: true, result };
                                    } catch (error: any) {
                                        return { success: false, error: error?.message || String(error) };
                                    }
                                }
                            };

                            successfullyLoaded++;
                        } catch (toolError) {
                            // Skip invalid tools
                        }
                    }

                    console.log(`[Agent] ✅ Loaded: ${successfullyLoaded} tools`);
                }
            } catch (mcpError) {
                console.error(`[Agent] ❌ MCP error:`, mcpError);
            }
        }

        // Audit log
        logChatAction(userId, 'chat.message', {
            mode: modeKey,
            model: modelId,
            messageLength: lastMessage?.content?.length || 0,
            toolCount: Object.keys(aiTools).length,
            ragSourceCount: ragSources.length,
        }, req).catch(() => {});

        const modelInstance = getModelInstance(modelId);

        const result = streamText({
            model: modelInstance,
            system: enhancedSystemPrompt,
            messages: messages as CoreMessage[],
            tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
        });

        // Stream response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullText = '';

                    for await (const chunk of (result as any).textStream) {
                        fullText += chunk;
                        controller.enqueue(encoder.encode(chunk));
                    }

                    console.log(`[Agent] ✓ Complete: ${fullText.length} chars`);

                    // Usage tracking
                    const durationMs = Date.now() - startTime;
                    trackSimpleUsage({
                        userId,
                        usageType: 'chat',
                        tokensInput: Math.ceil((lastMessage?.content?.length || 0) / 4),
                        tokensOutput: Math.ceil(fullText.length / 4),
                        modelId,
                        mode: modeKey,
                        durationMs,
                        success: true,
                        metadata: {
                            toolCount: Object.keys(aiTools).length,
                            ragSourceCount: ragSources.length,
                        },
                    }).catch(() => {});

                    // Append sources if asked
                    const askedAboutSources = userMessage.includes('source') ||
                        userMessage.includes('document') ||
                        userMessage.includes('reference');

                    if (ragSources.length > 0 && askedAboutSources) {
                        const sourcesText = '\n\n📚 **Sources:**\n' +
                            ragSources.map((s, i) =>
                                `${i + 1}. ${s.filename} (${(s.relevanceScore * 100).toFixed(0)}% relevant)`
                            ).join('\n');
                        controller.enqueue(encoder.encode(sourcesText));
                    }

                    controller.close();
                } catch (error) {
                    console.error('[Agent] ❌ Stream error:', error);
                    trackSimpleUsage({
                        userId,
                        usageType: 'chat',
                        tokensInput: 0,
                        tokensOutput: 0,
                        modelId,
                        mode: modeKey,
                        durationMs: Date.now() - startTime,
                        success: false,
                        metadata: { error: (error as Error).message },
                    }).catch(() => {});
                    controller.error(error);
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error("Chat API Error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Internal Server Error",
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
