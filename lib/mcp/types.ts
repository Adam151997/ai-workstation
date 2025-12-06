// lib/mcp/types.ts
// Model Context Protocol (MCP) Type Definitions
// Based on Anthropic's MCP Specification

// =============================================================================
// JSON-RPC 2.0 Base Types
// =============================================================================

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

// Standard JSON-RPC error codes
export const JSON_RPC_ERRORS = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
} as const;

// =============================================================================
// MCP Protocol Types
// =============================================================================

export type McpTransport = 'http' | 'sse' | 'websocket' | 'stdio';

export interface McpClientInfo {
    name: string;
    version: string;
}

export interface McpServerInfo {
    name: string;
    version: string;
}

// =============================================================================
// Capabilities
// =============================================================================

export interface McpClientCapabilities {
    experimental?: Record<string, unknown>;
    sampling?: Record<string, unknown>;
}

export interface McpServerCapabilities {
    experimental?: Record<string, unknown>;
    logging?: Record<string, unknown>;
    prompts?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    tools?: {
        listChanged?: boolean;
    };
}

// =============================================================================
// Initialize
// =============================================================================

export interface InitializeParams {
    protocolVersion: string;
    capabilities: McpClientCapabilities;
    clientInfo: McpClientInfo;
}

export interface InitializeResult {
    protocolVersion: string;
    capabilities: McpServerCapabilities;
    serverInfo: McpServerInfo;
    instructions?: string;
}

// =============================================================================
// Tools
// =============================================================================

export interface McpTool {
    name: string;
    description?: string;
    inputSchema: {
        type: 'object';
        properties?: Record<string, unknown>;
        required?: string[];
    };
}

export interface ListToolsResult {
    tools: McpTool[];
    nextCursor?: string;
}

export interface CallToolParams {
    name: string;
    arguments?: Record<string, unknown>;
}

export interface ToolContent {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
}

export interface CallToolResult {
    content: ToolContent[];
    isError?: boolean;
}

// =============================================================================
// Resources (Optional)
// =============================================================================

export interface McpResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface ListResourcesResult {
    resources: McpResource[];
    nextCursor?: string;
}

export interface ReadResourceParams {
    uri: string;
}

export interface ReadResourceResult {
    contents: Array<{
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    }>;
}

// =============================================================================
// Prompts (Optional)
// =============================================================================

export interface McpPrompt {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}

export interface ListPromptsResult {
    prompts: McpPrompt[];
    nextCursor?: string;
}

export interface GetPromptParams {
    name: string;
    arguments?: Record<string, string>;
}

export interface GetPromptResult {
    description?: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: {
            type: 'text' | 'image' | 'resource';
            text?: string;
            data?: string;
            mimeType?: string;
            resource?: {
                uri: string;
                mimeType?: string;
                text?: string;
            };
        };
    }>;
}

// =============================================================================
// Connection State
// =============================================================================

export type McpConnectionState = 
    | 'disconnected'
    | 'connecting'
    | 'initializing'
    | 'ready'
    | 'error';

export interface McpConnection {
    state: McpConnectionState;
    serverInfo?: McpServerInfo;
    capabilities?: McpServerCapabilities;
    error?: string;
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface McpClientConfig {
    /** Server URL (for HTTP/SSE/WebSocket) */
    url: string;
    /** Transport type */
    transport?: McpTransport;
    /** Custom headers for HTTP requests */
    headers?: Record<string, string>;
    /** Connection timeout in ms */
    timeout?: number;
    /** Auto-reconnect on disconnect */
    autoReconnect?: boolean;
    /** Client info to send during initialization */
    clientInfo?: McpClientInfo;
}

export const DEFAULT_CLIENT_INFO: McpClientInfo = {
    name: 'AI-Workstation',
    version: '2.0.0',
};

export const MCP_PROTOCOL_VERSION = '2024-11-05';
