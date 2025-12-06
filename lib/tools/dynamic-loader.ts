// lib/tools/dynamic-loader.ts
// Dynamic toolkit loader - UNIFIED MCP PROTOCOL
// All integrations (Composio + Custom) go through MCP Client

import { query } from '@/lib/db';
import { McpClient, mcpPool, McpTool, CallToolResult } from '@/lib/mcp';

// =============================================================================
// Types
// =============================================================================

interface LoadedTool {
    name: string;
    description: string;
    parameters?: Record<string, any>;
    toolkit: string;
    toolkitId: string;
    source: 'composio' | 'mcp' | 'rest';
    execute: (params: any) => Promise<any>;
}

interface ToolkitTools {
    toolkitId: string;
    toolkitName: string;
    source: 'composio' | 'mcp';
    tools: LoadedTool[];
}

interface UserToolkitRow {
    id: string;
    user_id: string;
    toolkit_id: string;
    custom_name?: string;
    custom_mcp_url?: string;
    custom_config: Record<string, any>;
    is_connected: boolean;
    connection_id?: string;
    enabled_actions: string[];
    disabled_actions: string[];
    name?: string;
    slug?: string;
    composio_app_id?: string;
    available_actions?: string[];
}

// =============================================================================
// Configuration
// =============================================================================

// Composio MCP Server endpoint
const COMPOSIO_MCP_BASE = 'https://backend.composio.dev/api/v2/mcp';

// =============================================================================
// Main Loader Functions
// =============================================================================

/**
 * Load all connected toolkits and their tools for a user
 * ALL integrations now go through unified MCP protocol
 */
export async function loadUserToolkits(userId: string): Promise<ToolkitTools[]> {
    const toolkits: UserToolkitRow[] = await query(`
        SELECT 
            ut.*,
            tc.name,
            tc.slug,
            tc.composio_app_id,
            tc.available_actions,
            tc.auth_type
        FROM user_toolkits ut
        LEFT JOIN toolkit_catalog tc ON ut.toolkit_id = tc.id
        WHERE ut.user_id = $1 
        AND ut.status = 'connected'
        AND ut.is_connected = true
    `, [userId]);

    const loadedToolkits: ToolkitTools[] = [];

    for (const toolkit of toolkits) {
        try {
            const tools = await loadToolkitToolsUnified(toolkit);
            
            if (tools.length > 0) {
                loadedToolkits.push({
                    toolkitId: toolkit.id,
                    toolkitName: toolkit.name || toolkit.custom_name || 'Unknown',
                    source: toolkit.composio_app_id ? 'composio' : 'mcp',
                    tools,
                });
            }
        } catch (error) {
            console.error(`[ToolLoader] Failed to load toolkit ${toolkit.name || toolkit.custom_name}:`, error);
        }
    }

    console.log(`[ToolLoader] Loaded ${loadedToolkits.length} toolkits (${loadedToolkits.reduce((sum, t) => sum + t.tools.length, 0)} tools) for user ${userId}`);

    return loadedToolkits;
}

/**
 * Unified tool loading - routes to appropriate MCP endpoint
 */
async function loadToolkitToolsUnified(toolkit: UserToolkitRow): Promise<LoadedTool[]> {
    // Composio-based toolkit → Composio MCP
    if (toolkit.composio_app_id && toolkit.connection_id) {
        return loadViaMcp(
            `composio-${toolkit.id}`,
            toolkit.composio_app_id,
            toolkit.connection_id,
            toolkit.enabled_actions || [],
            toolkit.disabled_actions || [],
            'composio'
        );
    }

    // Custom MCP toolkit → Direct MCP
    if (toolkit.custom_mcp_url) {
        return loadViaMcpDirect(
            toolkit.id,
            toolkit.custom_mcp_url,
            toolkit.custom_config || {},
            toolkit.enabled_actions || [],
            toolkit.disabled_actions || []
        );
    }

    return [];
}

// =============================================================================
// Unified MCP Loading
// =============================================================================

/**
 * Load tools via Composio's MCP endpoint
 */
async function loadViaMcp(
    clientId: string,
    appId: string,
    connectionId: string,
    enabledActions: string[],
    disabledActions: string[],
    source: 'composio' | 'mcp'
): Promise<LoadedTool[]> {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    
    if (!composioApiKey) {
        console.warn('[ToolLoader] Composio API key not configured, falling back to REST');
        return loadComposioRest(appId, connectionId, enabledActions, disabledActions);
    }

    try {
        // Connect to Composio via MCP protocol
        const client = await mcpPool.getClient(clientId, {
            url: COMPOSIO_MCP_BASE,
            headers: {
                'x-api-key': composioApiKey,
                'x-connection-id': connectionId,
                'x-app-name': appId,
            },
            transport: 'http',
            timeout: 30000,
        });

        // List tools via MCP
        const mcpTools = await client.getAllTools();

        // Filter based on user preferences
        const filteredTools = filterTools(mcpTools, enabledActions, disabledActions);

        // Convert to LoadedTool format
        return filteredTools.map((tool: McpTool) => ({
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema,
            toolkit: appId,
            toolkitId: clientId,
            source,
            execute: createUnifiedExecutor(clientId, tool.name, connectionId),
        }));

    } catch (error) {
        console.warn(`[ToolLoader] MCP failed for Composio ${appId}, falling back to REST:`, error);
        return loadComposioRest(appId, connectionId, enabledActions, disabledActions);
    }
}

/**
 * Load tools from custom MCP server directly
 */
async function loadViaMcpDirect(
    toolkitId: string,
    mcpUrl: string,
    config: Record<string, any>,
    enabledActions: string[],
    disabledActions: string[]
): Promise<LoadedTool[]> {
    try {
        const client = await mcpPool.getClient(toolkitId, {
            url: mcpUrl,
            headers: config.headers,
            transport: config.transport || 'http',
            timeout: config.timeout || 30000,
        });

        const mcpTools = await client.getAllTools();
        const filteredTools = filterTools(mcpTools, enabledActions, disabledActions);

        return filteredTools.map((tool: McpTool) => ({
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema,
            toolkit: 'custom',
            toolkitId: toolkitId,
            source: 'mcp' as const,
            execute: createUnifiedExecutor(toolkitId, tool.name),
        }));

    } catch (error) {
        console.warn(`[ToolLoader] MCP failed for ${mcpUrl}, trying REST fallback:`, error);
        return loadRestFallback(mcpUrl, config, enabledActions, disabledActions);
    }
}

// =============================================================================
// Unified Executor
// =============================================================================

/**
 * Create unified executor that works for both Composio and custom MCP
 */
function createUnifiedExecutor(clientId: string, toolName: string, connectionId?: string) {
    return async (params: any): Promise<any> => {
        const client = mcpPool.getConnectedClient(clientId);
        
        if (!client) {
            throw new Error(`MCP client ${clientId} not connected`);
        }

        // Execute via MCP protocol
        const result: CallToolResult = await client.callTool(toolName, {
            ...params,
            // Include connection context for Composio
            ...(connectionId && { _connectionId: connectionId }),
        });

        // Handle errors
        if (result.isError) {
            const errorText = result.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            throw new Error(errorText || 'Tool execution failed');
        }

        // Parse response
        return parseToolResult(result);
    };
}

/**
 * Parse MCP tool result into usable format
 */
function parseToolResult(result: CallToolResult): any {
    if (result.content.length === 0) {
        return null;
    }

    if (result.content.length === 1 && result.content[0].type === 'text') {
        try {
            return JSON.parse(result.content[0].text || '{}');
        } catch {
            return result.content[0].text;
        }
    }

    // Multiple content items - return structured
    return result.content.map(item => {
        if (item.type === 'text') return { type: 'text', value: item.text };
        if (item.type === 'image') return { type: 'image', data: item.data, mimeType: item.mimeType };
        if (item.type === 'resource') return { type: 'resource', ...item.resource };
        return item;
    });
}

// =============================================================================
// Fallbacks (REST API when MCP unavailable)
// =============================================================================

/**
 * Composio REST fallback
 */
async function loadComposioRest(
    appId: string,
    connectionId: string,
    enabledActions: string[],
    disabledActions: string[]
): Promise<LoadedTool[]> {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    
    if (!composioApiKey) {
        console.warn('[ToolLoader] Composio API key not configured');
        return [];
    }

    try {
        const response = await fetch(
            `https://backend.composio.dev/api/v1/actions?appNames=${appId}`,
            { headers: { 'x-api-key': composioApiKey } }
        );

        if (!response.ok) {
            throw new Error(`Composio API error: ${response.status}`);
        }

        const data = await response.json();
        const actions = data.items || [];
        const filteredActions = actions.filter((action: any) => {
            if (enabledActions.length > 0) return enabledActions.includes(action.name);
            return !disabledActions.includes(action.name);
        });

        return filteredActions.map((action: any) => ({
            name: action.name,
            description: action.description || `${action.name} action`,
            parameters: action.parameters,
            toolkit: appId,
            toolkitId: connectionId,
            source: 'rest' as const,
            execute: createComposioRestExecutor(action.name, connectionId, composioApiKey),
        }));

    } catch (error) {
        console.error(`[ToolLoader] Composio REST error for ${appId}:`, error);
        return [];
    }
}

function createComposioRestExecutor(actionName: string, connectionId: string, apiKey: string) {
    return async (params: any) => {
        const response = await fetch(
            'https://backend.composio.dev/api/v1/actions/execute',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify({
                    actionName,
                    connectedAccountId: connectionId,
                    input: params,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Composio execution failed: ${response.status}`);
        }

        return response.json();
    };
}

/**
 * Generic REST fallback for custom servers
 */
async function loadRestFallback(
    baseUrl: string,
    config: Record<string, any>,
    enabledActions: string[],
    disabledActions: string[]
): Promise<LoadedTool[]> {
    try {
        const response = await fetch(`${baseUrl}/tools`, {
            headers: { 'Content-Type': 'application/json', ...config.headers },
        });

        if (!response.ok) {
            throw new Error(`REST API error: ${response.status}`);
        }

        const data = await response.json();
        const tools = data.tools || [];
        const filteredTools = tools.filter((tool: any) => {
            if (enabledActions.length > 0) return enabledActions.includes(tool.name);
            return !disabledActions.includes(tool.name);
        });

        return filteredTools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || tool.parameters,
            toolkit: 'custom',
            toolkitId: baseUrl,
            source: 'rest' as const,
            execute: createRestExecutor(baseUrl, tool.name, config),
        }));

    } catch (error) {
        console.error(`[ToolLoader] REST fallback error for ${baseUrl}:`, error);
        return [];
    }
}

function createRestExecutor(baseUrl: string, toolName: string, config: Record<string, any>) {
    return async (params: any) => {
        const response = await fetch(`${baseUrl}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...config.headers },
            body: JSON.stringify({ tool: toolName, input: params }),
        });

        if (!response.ok) {
            throw new Error(`REST execution failed: ${response.status}`);
        }

        return response.json();
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter tools based on user preferences
 */
function filterTools(tools: McpTool[], enabledActions: string[], disabledActions: string[]): McpTool[] {
    return tools.filter(tool => {
        if (enabledActions.length > 0) {
            return enabledActions.includes(tool.name);
        }
        return !disabledActions.includes(tool.name);
    });
}

/**
 * Get a flat list of all available tools for a user
 */
export async function getUserTools(userId: string): Promise<LoadedTool[]> {
    const toolkits = await loadUserToolkits(userId);
    return toolkits.flatMap(t => t.tools);
}

/**
 * Check if user has any connected toolkits
 */
export async function hasConnectedToolkits(userId: string): Promise<boolean> {
    const result = await query(`
        SELECT COUNT(*) as count 
        FROM user_toolkits 
        WHERE user_id = $1 AND status = 'connected' AND is_connected = true
    `, [userId]);

    return parseInt(result[0].count) > 0;
}

/**
 * Record toolkit usage
 */
export async function recordToolkitUsage(toolkitId: string): Promise<void> {
    await query(`
        UPDATE user_toolkits 
        SET usage_count = usage_count + 1, last_used_at = NOW() 
        WHERE id = $1
    `, [toolkitId]);
}

/**
 * Get toolkit summary for a user
 */
export async function getToolkitSummary(userId: string): Promise<{
    installed: number;
    connected: number;
    totalTools: number;
    bySource: { composio: number; mcp: number; rest: number };
}> {
    const stats = await query(`
        SELECT 
            COUNT(*) as installed,
            COUNT(*) FILTER (WHERE status = 'connected' AND is_connected = true) as connected
        FROM user_toolkits 
        WHERE user_id = $1
    `, [userId]);

    const toolkits = await loadUserToolkits(userId);
    const allTools = toolkits.flatMap(t => t.tools);

    return {
        installed: parseInt(stats[0].installed),
        connected: parseInt(stats[0].connected),
        totalTools: allTools.length,
        bySource: {
            composio: allTools.filter(t => t.source === 'composio').length,
            mcp: allTools.filter(t => t.source === 'mcp').length,
            rest: allTools.filter(t => t.source === 'rest').length,
        },
    };
}

/**
 * Disconnect all MCP clients (cleanup)
 */
export function disconnectAllMcp(): void {
    mcpPool.disconnectAll();
}

/**
 * Get MCP connection status
 */
export function getMcpConnectionStatus(): Record<string, any> {
    return mcpPool.getConnectionStatus();
}

/**
 * Test MCP connection to a URL
 */
export async function testMcpConnection(url: string, headers?: Record<string, string>): Promise<{
    success: boolean;
    serverInfo?: { name: string; version: string };
    error?: string;
}> {
    const testId = `test-${Date.now()}`;
    
    try {
        const client = await mcpPool.getClient(testId, {
            url,
            headers,
            transport: 'http',
            timeout: 10000,
        });

        const connection = client.connection;
        mcpPool.disconnectClient(testId);

        return {
            success: true,
            serverInfo: connection.serverInfo,
        };
    } catch (error: any) {
        mcpPool.disconnectClient(testId);
        return {
            success: false,
            error: error.message,
        };
    }
}
