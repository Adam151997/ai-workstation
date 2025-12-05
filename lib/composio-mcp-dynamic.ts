// lib/composio-mcp-dynamic.ts
// MCP (Model Context Protocol) client with DYNAMIC per-user URL generation

import { Composio } from '@composio/core';
import { type Mode } from '@/config/modes';

interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
}

// Simple in-memory cache (5 minutes)
const toolsCache = new Map<string, { tools: MCPTool[]; timestamp: number }>();
const urlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ComposioMCPClient {
    private composio: Composio;
    private mode: Mode;
    private userId: string;
    private userToolSlugs: string[];

    constructor(mode: Mode, userId: string, userToolSlugs?: string[]) {
        this.composio = new Composio({ 
            apiKey: process.env.COMPOSIO_API_KEY 
        });
        this.mode = mode;
        this.userId = userId;
        this.userToolSlugs = userToolSlugs || [];
        
        console.log(`[MCP] 🔧 Initialized for user ${userId} with ${this.userToolSlugs.length} tools: ${this.userToolSlugs.join(', ')}`);
    }

    /**
     * ✅ NEW: Get the MCP config ID for the current mode
     */
    private getMCPConfigId(): string {
        const configMap: Record<Mode, string> = {
            'Sales': process.env.MCP_CONFIG_SALES || '',
            'Marketing': process.env.MCP_CONFIG_MARKETING || '',
            'Admin': process.env.MCP_CONFIG_ADMIN || '',
        };
        
        const configId = configMap[this.mode];
        
        if (!configId) {
            throw new Error(`No MCP config ID found for mode: ${this.mode}. Run setup-mcp-configs script first!`);
        }
        
        return configId;
    }

    /**
     * ✅ NEW: Generate user-specific MCP URL dynamically
     */
    private async getUserMCPUrl(): Promise<string> {
        const cacheKey = `${this.mode}-${this.userId}`;
        
        // Check cache
        const cached = urlCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[MCP] Using cached URL for user ${this.userId}`);
            return cached.url;
        }

        console.log(`[MCP] 🔗 Generating MCP URL for user ${this.userId}...`);

        try {
            const mcpConfigId = this.getMCPConfigId();
            
            // Generate user-specific MCP instance
            const instance = await this.composio.mcp.generate(
                this.userId,
                mcpConfigId
            );
            
            console.log(`[MCP] ✅ Generated URL: ${instance.url}`);
            
            // Cache the URL
            urlCache.set(cacheKey, { url: instance.url, timestamp: Date.now() });
            
            return instance.url;
        } catch (error: any) {
            console.error(`[MCP] ❌ Failed to generate URL:`, error.message);
            throw error;
        }
    }

    /**
     * Parse SSE (Server-Sent Events) format response
     */
    private parseSSE(sseText: string): any {
        const lines = sseText.split('\n');
        let jsonData = '';
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                jsonData += line.substring(6);
            }
        }
        
        if (jsonData) {
            return JSON.parse(jsonData);
        }
        
        throw new Error('No valid JSON data found in SSE response');
    }

    /**
     * Check if a tool name matches any of the user's enabled tool slugs
     */
    private isToolEnabled(toolName: string): boolean {
        if (this.userToolSlugs.length === 0) {
            return true;
        }

        const lowerToolName = toolName.toLowerCase();
        
        return this.userToolSlugs.some(slug => {
            const lowerSlug = slug.toLowerCase();
            return lowerToolName.startsWith(lowerSlug) || 
                   lowerToolName.includes(`_${lowerSlug}_`) ||
                   lowerToolName.includes(`-${lowerSlug}-`);
        });
    }

    /**
     * ✅ IMPROVED: Fetch tools using user's dynamic MCP URL
     */
    async getTools(): Promise<MCPTool[]> {
        const cacheKey = `${this.mode}-${this.userId}-${this.userToolSlugs.sort().join(',')}`;
        
        // Check cache
        const cached = toolsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[MCP] Using cached tools for user ${this.userId}`);
            return cached.tools;
        }

        console.log(`[MCP] Fetching tools for ${this.mode} mode (user: ${this.userId})...`);

        try {
            // ✅ Generate user-specific MCP URL
            const mcpUrl = await this.getUserMCPUrl();
            
            const response = await fetch(mcpUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/list',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[MCP] API error response:`, errorText);
                throw new Error(`MCP API error: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                data = this.parseSSE(responseText);
            }
            
            if (data.error) {
                throw new Error(`MCP error: ${data.error.message}`);
            }

            let tools: MCPTool[] = data.result?.tools || [];
            
            // ✅ STILL filter by user's selected tools (defense in depth)
            if (this.userToolSlugs.length > 0) {
                const originalCount = tools.length;
                tools = tools.filter(tool => this.isToolEnabled(tool.name));
                
                console.log(`[MCP] 🔍 Filtered: ${originalCount} total → ${tools.length} user-enabled tools`);
            }
            
            console.log(`[MCP] ✓ Final toolkit: ${tools.length} tools for ${this.mode} mode`);
            if (tools.length > 0 && tools.length <= 15) {
                console.log(`[MCP] Tools:`, tools.map(t => t.name).join(', '));
            }
            
            // Cache the results
            toolsCache.set(cacheKey, { tools, timestamp: Date.now() });
            
            return tools;
        } catch (error) {
            console.error(`[MCP] ❌ Error fetching tools:`, error);
            return [];
        }
    }

    /**
     * ✅ IMPROVED: Execute tool using user's dynamic MCP URL
     */
    async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
        console.log(`[MCP] Executing tool: ${toolName} for user ${this.userId}`);
        console.log(`[MCP] Arguments:`, JSON.stringify(args, null, 2));

        try {
            // ✅ Use user-specific MCP URL
            const mcpUrl = await this.getUserMCPUrl();
            
            const response = await fetch(mcpUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/call',
                    params: {
                        name: toolName,
                        arguments: args,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[MCP] Execute error response:`, errorText);
                throw new Error(`MCP API error: ${response.status} ${response.statusText}`);
            }

            const responseText = await response.text();
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                data = this.parseSSE(responseText);
            }
            
            if (data.error) {
                throw new Error(`MCP tool execution error: ${data.error.message}`);
            }

            console.log(`[MCP] ✅ Tool executed successfully for user ${this.userId}`);
            return data.result;
        } catch (error) {
            console.error(`[MCP] ❌ Tool execution failed:`, error);
            throw error;
        }
    }

    /**
     * Clear the caches
     */
    static clearCache(userId?: string, mode?: Mode) {
        if (userId && mode) {
            const toolCacheKey = `${mode}-${userId}`;
            const urlCacheKey = `${mode}-${userId}`;
            
            // Clear matching entries
            for (const key of toolsCache.keys()) {
                if (key.startsWith(toolCacheKey)) {
                    toolsCache.delete(key);
                }
            }
            urlCache.delete(urlCacheKey);
            
            console.log(`[MCP] Cache cleared for user ${userId}, mode ${mode}`);
        } else {
            toolsCache.clear();
            urlCache.clear();
            console.log(`[MCP] All caches cleared`);
        }
    }
}
