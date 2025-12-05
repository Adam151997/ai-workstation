// lib/composio-mcp.ts
// MCP (Model Context Protocol) client for Composio integration with USER-SPECIFIC TOOLKIT

import { MCP_CONFIGS, type Mode } from '@/config/mcp-configs';

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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ComposioMCPClient {
    private mode: Mode;
    private config: typeof MCP_CONFIGS[Mode];
    private userToolSlugs: string[]; // ✅ NEW: User's enabled tools

    constructor(mode: Mode, userToolSlugs?: string[]) {
        this.mode = mode;
        this.config = MCP_CONFIGS[mode];
        this.userToolSlugs = userToolSlugs || []; // ✅ Store user's toolkit
        
        if (!this.config) {
            throw new Error(`No MCP config found for mode: ${mode}`);
        }

        console.log(`[MCP] 🔧 Initialized with ${this.userToolSlugs.length} user tools: ${this.userToolSlugs.join(', ')}`);
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
     * Example: tool "hubspot_create_contact" matches slug "hubspot"
     */
    private isToolEnabled(toolName: string): boolean {
        // If no user tools specified, allow all (backward compatibility)
        if (this.userToolSlugs.length === 0) {
            return true;
        }

        const lowerToolName = toolName.toLowerCase();
        
        // Check if tool name starts with any enabled slug
        return this.userToolSlugs.some(slug => {
            const lowerSlug = slug.toLowerCase();
            return lowerToolName.startsWith(lowerSlug) || 
                   lowerToolName.includes(`_${lowerSlug}_`) ||
                   lowerToolName.includes(`-${lowerSlug}-`);
        });
    }

    /**
     * Fetch available tools from MCP server
     * ✅ NOW FILTERS BY USER'S ENABLED TOOLS
     * Uses caching to avoid repeated API calls
     */
    async getTools(): Promise<MCPTool[]> {
        // Create cache key that includes user tools
        const cacheKey = `${this.mode}-${this.userToolSlugs.sort().join(',')}`;
        
        // Check cache
        const cached = toolsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[MCP] Using cached tools for ${this.mode} mode (user-specific)`);
            return cached.tools;
        }

        console.log(`[MCP] Fetching tools for ${this.mode} mode...`);

        try {
            const url = `${this.config.httpEndpoint}?user_id=${this.config.externalUserId}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                    'x-api-key': this.config.apiKey,
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
            
            // Try to parse as JSON first, fall back to SSE
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                // Response is SSE format, parse it
                data = this.parseSSE(responseText);
            }
            
            if (data.error) {
                throw new Error(`MCP error: ${data.error.message}`);
            }

            let tools: MCPTool[] = data.result?.tools || [];
            
            // ✅ FILTER TOOLS BASED ON USER'S ENABLED LIST
            if (this.userToolSlugs.length > 0) {
                const originalCount = tools.length;
                tools = tools.filter(tool => this.isToolEnabled(tool.name));
                
                console.log(`[MCP] 🔍 Filtered: ${originalCount} total → ${tools.length} user-enabled tools`);
            }
            
            console.log(`[MCP] ✓ Final toolkit: ${tools.length} tools for ${this.mode} mode`);
            if (tools.length > 0) {
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
     * Execute a tool via MCP protocol
     */
    async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
        console.log(`[MCP] Executing tool: ${toolName}`);
        console.log(`[MCP] Arguments:`, JSON.stringify(args, null, 2));

        try {
            const url = `${this.config.httpEndpoint}?user_id=${this.config.externalUserId}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                    'x-api-key': this.config.apiKey,
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
            
            // Try to parse as JSON first, fall back to SSE
            let data;
            try {
                data = JSON.parse(responseText);
            } catch {
                // Response is SSE format, parse it
                data = this.parseSSE(responseText);
            }
            
            if (data.error) {
                throw new Error(`MCP tool execution error: ${data.error.message}`);
            }

            console.log(`[MCP] ✅ Tool executed successfully`);
            return data.result;
        } catch (error) {
            console.error(`[MCP] ❌ Tool execution failed:`, error);
            throw error;
        }
    }

    /**
     * Clear the tools cache (useful for testing or manual refresh)
     */
    static clearCache(mode?: Mode) {
        if (mode) {
            // Clear all caches for this mode (including user-specific ones)
            const keysToDelete: string[] = [];
            for (const key of toolsCache.keys()) {
                if (key.startsWith(`${mode}-`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach(key => toolsCache.delete(key));
            console.log(`[MCP] Cache cleared for ${mode} mode (${keysToDelete.length} entries)`);
        } else {
            toolsCache.clear();
            console.log(`[MCP] All cache cleared`);
        }
    }
}
