// app/api/chat/route.ts - WITH RAG INTEGRATION + DYNAMIC USER TOOLKIT + AUDIT LOGGING + USAGE TRACKING
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

export const maxDuration = 60;

// Tools enabled with improved prompt controls
const ENABLE_TOOLS = true;

// RAG enabled
const ENABLE_RAG = true;

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
                
                // Make optional if not in required array
                if (!required.includes(key)) {
                    propZod = propZod.optional();
                }
                
                shape[key] = propZod;
            }

            return z.object(shape);

        default:
            // Handle union types like "string,null"
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

    // Deep clone to avoid mutating original
    const schema = JSON.parse(JSON.stringify(inputSchema));

    // Ensure type is "object" at root level
    if (!schema.type) {
        schema.type = 'object';
    }

    // Ensure properties exist
    if (!schema.properties) {
        schema.properties = {};
    }

    // Clean up properties recursively
    if (schema.properties) {
        for (const key in schema.properties) {
            const prop = schema.properties[key];
            
            // Remove 'default' values
            delete prop.default;
            
            // Handle union types like "string,null" - convert to just "string"
            if (typeof prop.type === 'string' && prop.type.includes(',')) {
                const types = prop.type.split(',').map((t: string) => t.trim());
                prop.type = types.find((t: string) => t !== 'null') || 'string';
            }
            
            // Handle "undefined" type
            if (prop.type === 'undefined') {
                prop.type = 'string';
            }

            // Ensure all properties have a valid type
            if (!prop.type) {
                prop.type = 'string';
            }

            // Clean nested arrays
            if (prop.type === 'array' && prop.items) {
                delete prop.items.default;
                if (!prop.items.type) {
                    prop.items.type = 'string';
                }
            }
        }
    }

    // Remove $schema if present
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
            // ✅ Use openai.chat() to force Chat Completions API
            return openai.chat(modelId);
        default:
            console.warn(`[Agent] Unknown provider: ${modelInfo.provider}`);
            return groq(DEFAULT_MODEL);
    }
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
            // Don't block on rate limit errors, just log
            console.error('[Agent] Rate limit check failed:', rateLimitError);
        }

        const { messages, selectedMode, selectedModel, requestArtifact } = await req.json();

        // ============================================
        // ARTIFACT DETECTION & GENERATION
        // ============================================

        const lastMessage = messages[messages.length - 1];
        const userMessage = lastMessage?.content?.toLowerCase() || '';

        // Artifact keywords detection
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
            console.log(`[Artifact] Document: ${isDocumentRequest}, Table: ${isTableRequest}, Chart: ${isChartRequest}`);

            const { generateDocumentArtifact, generateTableArtifact, generateChartArtifact } = await import('@/app/actions/artifacts');

            let artifactType = requestArtifact || 'document';
            let artifactStream;

            // Determine artifact type
            if (!requestArtifact) {
                if (isChartRequest) {
                    artifactType = 'chart';
                } else if (isTableRequest) {
                    artifactType = 'table';
                } else {
                    artifactType = 'document';
                }
            }

            // Generate artifact
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

            console.log(`[Artifact] ✅ Generating ${artifactType} artifact`);

            // Return special artifact response
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
        // REGULAR CHAT FLOW (if not artifact request)
        // ============================================

        const modeKey = (selectedMode as Mode) || 'Sales';
        const modeConfig = MODES_CONFIG[modeKey];
        const modelId = selectedModel || DEFAULT_MODEL;
        const modelInfo = getModelInfo(modelId);

        console.log(`[Agent] Mode: ${modeKey}, Model: ${modelId} (${modelInfo?.provider || 'unknown'})`);
        console.log(`[Agent] Conversation history: ${messages?.length || 0} messages`);

        if (messages && messages.length > 0) {
            console.log(`[Agent] Last message: "${lastMessage.content.substring(0, 100)}..."`);
        }

        // ============================================
        // ✨ DYNAMIC USER TOOLKIT LOADING ✨
        // ============================================

        console.log('[Toolkit] 🔧 Loading user\'s personalized toolkit...');
        const userToolSlugs = await getUserToolSlugs(userId);
        console.log(`[Toolkit] ✅ User has ${userToolSlugs.length} tools enabled: ${userToolSlugs.join(', ')}`);

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
                    { topK: 3 } // Top 3 most relevant chunks
                );

                if (ragContext.hasContext) {
                    console.log(`[RAG] ✅ Found ${ragContext.sources.length} relevant chunks`);
                    enhancedSystemPrompt = injectRAGContext(modeConfig.systemPrompt, ragContext.context);
                    ragSources = ragContext.sources;
                } else {
                    console.log('[RAG] ℹ️ No relevant documents found');
                }
            } catch (ragError) {
                console.error('[RAG] ⚠️ Error retrieving context:', ragError);
                // Continue without RAG if it fails
            }
        }

        // ✅ Build tools using Zod schemas (AI SDK's preferred format)
        const aiTools: Record<string, any> = {};

        // Store MCP client reference for tool execution
        let mcpClientRef: ComposioMCPClient | null = null;

        // Check if model supports tools
        const supportsTools = modelInfo?.supportsTools ?? true;

        // ✅ TOOLS NOW ENABLED FOR ALL PROVIDERS
        const enableToolsForThisRequest = ENABLE_TOOLS && supportsTools;
        console.log(`[Agent] Tools enabled: ${enableToolsForThisRequest} for ${modelInfo?.provider || 'unknown'} provider`);

        if (enableToolsForThisRequest) {
            // ✅ PASS USER'S TOOL SLUGS TO MCP CLIENT
            const mcpClient = new ComposioMCPClient(modeKey, userId, userToolSlugs);
            mcpClientRef = mcpClient;

            try {
                const mcpTools = await mcpClient.getTools();

                if (mcpTools.length > 0) {
                    // ✅ LIMIT TOOLS TO 128 (Groq/OpenAI limit)
                    const MAX_TOOLS = 128;
                    let limitedTools = mcpTools;
                    if (mcpTools.length > MAX_TOOLS) {
                        console.log(`[Agent] ⚠️ Too many tools (${mcpTools.length}), limiting to ${MAX_TOOLS}`);
                        limitedTools = mcpTools.slice(0, MAX_TOOLS);
                    }

                    console.log(`[Agent] 📦 Loading ${limitedTools.length} tools from user's toolkit...`);

                    let successfullyLoaded = 0;
                    let skipped = 0;

                    for (const mcpTool of limitedTools) {
                        try {
                            // ✅ SKIP TOOLS WITH NO PROPERTIES (OpenAI requirement)
                            const hasProperties = mcpTool.inputSchema?.properties &&
                                Object.keys(mcpTool.inputSchema.properties).length > 0;

                            if (!hasProperties) {
                                console.log(`[Agent] ⚠️ Skipping ${mcpTool.name}: no parameters`);
                                skipped++;
                                continue;
                            }

                            // ✅ Clean the JSON Schema first
                            const cleanedSchema = cleanJsonSchema(mcpTool.inputSchema);

                            // DEBUG: Log first tool's cleaned schema
                            if (successfullyLoaded === 0) {
                                console.log(`[DEBUG] First tool schema (${mcpTool.name}):`, JSON.stringify(cleanedSchema, null, 2));
                            }

                            // ✅ Convert to Zod schema
                            const zodSchema = jsonSchemaToZod(cleanedSchema);

                            // DEBUG: Log first tool's Zod schema
                            if (successfullyLoaded === 0) {
                                console.log(`[DEBUG] Zod schema created for ${mcpTool.name}`);
                            }

                            const enhancedDescription = mcpTool.description || `Execute ${mcpTool.name}`;
                            const toolName = mcpTool.name;

                            // ✅ Use AI SDK v5 tool format with Zod (inputSchema instead of parameters)
                            aiTools[toolName] = {
                                description: enhancedDescription,
                                inputSchema: zodSchema,
                                execute: async (args: Record<string, any>) => {
                                    console.log(`[Agent] 🔧 Executing: ${toolName}`);
                                    console.log(`[Agent] Args:`, JSON.stringify(args, null, 2));

                                    try {
                                        const result = await mcpClient.executeTool(toolName, args);
                                        console.log(`[Agent] ✅ Success:`, toolName);

                                        return {
                                            success: true,
                                            result: result,
                                            message: `Successfully executed ${toolName}`
                                        };
                                    } catch (error: any) {
                                        console.error(`[Agent] ❌ Error:`, error);
                                        return {
                                            success: false,
                                            error: error?.message || String(error),
                                            message: `Failed to execute ${toolName}`
                                        };
                                    }
                                }
                            };

                            successfullyLoaded++;
                            
                            // Only log first 10 tools to reduce noise
                            if (successfullyLoaded <= 10) {
                                console.log(`[Agent] ✓ Loaded tool: ${mcpTool.name}`);
                            }
                        } catch (toolError) {
                            console.error(`[Agent] ⚠️ Failed to load tool ${mcpTool.name}:`, toolError);
                            skipped++;
                        }
                    }

                    console.log(`[Agent] ✅ Successfully loaded: ${successfullyLoaded} tools`);
                    if (skipped > 0) {
                        console.log(`[Agent] ⚠️ Skipped: ${skipped} tools (no params or invalid schema)`);
                    }
                } else {
                    console.log(`[Agent] ℹ️ No tools available in user's toolkit`);
                }
            } catch (mcpError) {
                console.error(`[Agent] ❌ MCP error:`, mcpError);
                console.log(`[Agent] Continuing without tools...`);
            }
        } else {
            console.log(`[Agent] ⚠️ Tools disabled for this request`);
        }

        console.log(`[Agent] 🚀 Starting stream with ${Object.keys(aiTools).length} tools...`);

        // Audit log for chat message (non-blocking)
        logChatAction(userId, 'chat.message', {
            mode: modeKey,
            model: modelId,
            messageLength: lastMessage?.content?.length || 0,
            toolCount: Object.keys(aiTools).length,
            ragSourceCount: ragSources.length,
        }, req).catch(() => {}); // Fire and forget

        const modelInstance = getModelInstance(modelId);

        const result = streamText({
            model: modelInstance,
            system: enhancedSystemPrompt, // Uses RAG-enhanced prompt
            messages: messages as CoreMessage[],
            tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
            maxSteps: 5,
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

                    // ============================================
                    // USAGE TRACKING (estimate tokens from text length)
                    // ============================================
                    const durationMs = Date.now() - startTime;
                    const inputText = lastMessage?.content || '';
                    // Rough estimation: ~4 chars per token
                    const estimatedInputTokens = Math.ceil(inputText.length / 4);
                    const estimatedOutputTokens = Math.ceil(fullText.length / 4);
                    
                    // Track usage (fire and forget)
                    trackSimpleUsage({
                        userId,
                        usageType: 'chat',
                        tokensInput: estimatedInputTokens,
                        tokensOutput: estimatedOutputTokens,
                        modelId,
                        mode: modeKey,
                        durationMs,
                        success: true,
                        metadata: {
                            toolCount: Object.keys(aiTools).length,
                            ragSourceCount: ragSources.length,
                        },
                    }).catch(err => console.error('[Agent] Usage tracking error:', err));

                    // ✅ Only append sources if user asks about documents/sources
                    const askedAboutSources = userMessage.includes('source') ||
                        userMessage.includes('document') ||
                        userMessage.includes('reference') ||
                        userMessage.includes('where') ||
                        userMessage.includes('citation');

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
                    
                    // Track failed usage
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
