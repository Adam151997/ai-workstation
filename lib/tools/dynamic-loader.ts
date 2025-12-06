// lib/tools/dynamic-loader.ts
// Dynamic toolkit loader - loads only user's installed and connected toolkits

import { query } from '@/lib/db';

interface LoadedTool {
    name: string;
    description: string;
    toolkit: string;
    toolkitId: string;
    execute: (params: any) => Promise<any>;
}

interface ToolkitTools {
    toolkitId: string;
    toolkitName: string;
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

/**
 * Load all connected toolkits and their tools for a user
 */
export async function loadUserToolkits(userId: string): Promise<ToolkitTools[]> {
    // Get user's installed and connected toolkits
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
        const tools = await loadToolkitTools(toolkit);
        
        if (tools.length > 0) {
            loadedToolkits.push({
                toolkitId: toolkit.id,
                toolkitName: toolkit.name || toolkit.custom_name || 'Unknown',
                tools,
            });
        }
    }

    console.log(`[ToolLoader] Loaded ${loadedToolkits.length} toolkits for user ${userId}`);

    return loadedToolkits;
}

/**
 * Load tools for a specific toolkit
 */
async function loadToolkitTools(toolkit: UserToolkitRow): Promise<LoadedTool[]> {
    const tools: LoadedTool[] = [];

    // For Composio-based toolkits
    if (toolkit.composio_app_id && toolkit.connection_id) {
        try {
            const composioTools = await loadComposioTools(
                toolkit.composio_app_id,
                toolkit.connection_id,
                toolkit.enabled_actions || [],
                toolkit.disabled_actions || []
            );
            tools.push(...composioTools);
        } catch (error) {
            console.error(`[ToolLoader] Failed to load Composio tools for ${toolkit.name}:`, error);
        }
    }

    // For custom MCP toolkits
    if (toolkit.custom_mcp_url) {
        try {
            const mcpTools = await loadMcpTools(
                toolkit.custom_mcp_url,
                toolkit.custom_config || {}
            );
            tools.push(...mcpTools);
        } catch (error) {
            console.error(`[ToolLoader] Failed to load MCP tools for ${toolkit.custom_name}:`, error);
        }
    }

    return tools;
}

/**
 * Load tools from Composio for a connected app
 */
async function loadComposioTools(
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
        // Get available actions for this app
        const response = await fetch(
            `https://backend.composio.dev/api/v1/actions?appNames=${appId}`,
            {
                headers: {
                    'x-api-key': composioApiKey,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Composio API error: ${response.status}`);
        }

        const data = await response.json();
        const actions = data.items || [];

        // Filter actions based on user preferences
        const filteredActions = actions.filter((action: any) => {
            // If user has enabled specific actions, only include those
            if (enabledActions.length > 0) {
                return enabledActions.includes(action.name);
            }
            // Otherwise, exclude disabled actions
            return !disabledActions.includes(action.name);
        });

        // Convert to LoadedTool format
        return filteredActions.map((action: any) => ({
            name: action.name,
            description: action.description || `${action.name} action`,
            toolkit: appId,
            toolkitId: connectionId,
            execute: createComposioExecutor(action.name, connectionId, composioApiKey),
        }));

    } catch (error) {
        console.error(`[ToolLoader] Composio error for ${appId}:`, error);
        return [];
    }
}

/**
 * Create an executor function for a Composio action
 */
function createComposioExecutor(actionName: string, connectionId: string, apiKey: string) {
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
 * Load tools from a custom MCP server
 */
async function loadMcpTools(
    mcpUrl: string,
    config: Record<string, any>
): Promise<LoadedTool[]> {
    try {
        // Get available tools from MCP server
        const response = await fetch(`${mcpUrl}/tools`, {
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`MCP server error: ${response.status}`);
        }

        const data = await response.json();
        const tools = data.tools || [];

        return tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            toolkit: 'custom',
            toolkitId: mcpUrl,
            execute: createMcpExecutor(mcpUrl, tool.name, config),
        }));

    } catch (error) {
        console.error(`[ToolLoader] MCP error for ${mcpUrl}:`, error);
        return [];
    }
}

/**
 * Create an executor function for an MCP tool
 */
function createMcpExecutor(mcpUrl: string, toolName: string, config: Record<string, any>) {
    return async (params: any) => {
        const response = await fetch(`${mcpUrl}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            body: JSON.stringify({
                tool: toolName,
                input: params,
            }),
        });

        if (!response.ok) {
            throw new Error(`MCP execution failed: ${response.status}`);
        }

        return response.json();
    };
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
 * Get toolkit summary for a user (for UI display)
 */
export async function getToolkitSummary(userId: string): Promise<{
    installed: number;
    connected: number;
    totalTools: number;
}> {
    const stats = await query(`
        SELECT 
            COUNT(*) as installed,
            COUNT(*) FILTER (WHERE status = 'connected' AND is_connected = true) as connected
        FROM user_toolkits 
        WHERE user_id = $1
    `, [userId]);

    const toolkits = await loadUserToolkits(userId);
    const totalTools = toolkits.reduce((sum, t) => sum + t.tools.length, 0);

    return {
        installed: parseInt(stats[0].installed),
        connected: parseInt(stats[0].connected),
        totalTools,
    };
}
