// lib/mcp/client.ts
// MCP Client - Full Protocol Implementation

import {
    JsonRpcRequest,
    JsonRpcResponse,
    McpClientConfig,
    McpClientCapabilities,
    McpServerCapabilities,
    McpServerInfo,
    McpConnectionState,
    McpConnection,
    McpTool,
    McpResource,
    McpPrompt,
    InitializeParams,
    InitializeResult,
    ListToolsResult,
    CallToolParams,
    CallToolResult,
    ListResourcesResult,
    ReadResourceParams,
    ReadResourceResult,
    ListPromptsResult,
    GetPromptParams,
    GetPromptResult,
    DEFAULT_CLIENT_INFO,
    MCP_PROTOCOL_VERSION,
} from './types';
import { Transport, createTransport, TransportConfig } from './transport';

export class McpClient {
    private config: McpClientConfig;
    private transport: Transport | null = null;
    private requestId = 0;
    private state: McpConnectionState = 'disconnected';
    private serverInfo: McpServerInfo | null = null;
    private serverCapabilities: McpServerCapabilities | null = null;
    private error: string | null = null;

    // Event handlers
    public onStateChange?: (state: McpConnectionState) => void;
    public onError?: (error: Error) => void;

    constructor(config: McpClientConfig) {
        this.config = {
            transport: 'http',
            timeout: 30000,
            autoReconnect: false,
            clientInfo: DEFAULT_CLIENT_INFO,
            ...config,
        };
    }

    // =========================================================================
    // Connection Management
    // =========================================================================

    get connection(): McpConnection {
        return {
            state: this.state,
            serverInfo: this.serverInfo || undefined,
            capabilities: this.serverCapabilities || undefined,
            error: this.error || undefined,
        };
    }

    get isReady(): boolean {
        return this.state === 'ready';
    }

    private setState(state: McpConnectionState): void {
        this.state = state;
        if (this.onStateChange) {
            this.onStateChange(state);
        }
    }

    async connect(): Promise<void> {
        if (this.state === 'ready' || this.state === 'connecting') {
            return;
        }

        this.setState('connecting');
        this.error = null;

        try {
            // Create transport
            const transportConfig: TransportConfig = {
                url: this.config.url,
                headers: this.config.headers,
                timeout: this.config.timeout,
            };

            this.transport = createTransport(
                this.config.transport || 'http',
                transportConfig
            );

            this.transport.onError = (error) => {
                this.error = error.message;
                this.setState('error');
                if (this.onError) {
                    this.onError(error);
                }
            };

            this.transport.onClose = () => {
                this.setState('disconnected');
            };

            // Initialize connection
            this.setState('initializing');
            await this.initialize();
            this.setState('ready');

            console.log(`[MCP] Connected to ${this.serverInfo?.name} v${this.serverInfo?.version}`);

        } catch (error: any) {
            this.error = error.message;
            this.setState('error');
            throw error;
        }
    }

    disconnect(): void {
        if (this.transport) {
            this.transport.close();
            this.transport = null;
        }
        this.serverInfo = null;
        this.serverCapabilities = null;
        this.setState('disconnected');
    }

    // =========================================================================
    // JSON-RPC Communication
    // =========================================================================

    private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
        if (!this.transport) {
            throw new Error('Not connected');
        }

        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: ++this.requestId,
            method,
            params,
        };

        console.log(`[MCP] → ${method}`, params || '');

        const response = await this.transport.send(request);

        if (!response) {
            throw new Error('No response received');
        }

        if (response.error) {
            console.error(`[MCP] ← Error:`, response.error);
            throw new Error(`${response.error.message} (code: ${response.error.code})`);
        }

        console.log(`[MCP] ← ${method}`, response.result);

        return response.result as T;
    }

    private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
        if (!this.transport) {
            throw new Error('Not connected');
        }

        await this.transport.send({
            jsonrpc: '2.0',
            method,
            params,
        });

        console.log(`[MCP] → (notify) ${method}`, params || '');
    }

    // =========================================================================
    // Protocol Methods
    // =========================================================================

    private async initialize(): Promise<void> {
        const params: InitializeParams = {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: this.config.clientInfo || DEFAULT_CLIENT_INFO,
        };

        const result = await this.request<InitializeResult>('initialize', params as unknown as Record<string, unknown>);

        this.serverInfo = result.serverInfo;
        this.serverCapabilities = result.capabilities;

        // Send initialized notification
        await this.notify('notifications/initialized');
    }

    // =========================================================================
    // Tools
    // =========================================================================

    async listTools(cursor?: string): Promise<ListToolsResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        return this.request<ListToolsResult>('tools/list', cursor ? { cursor } : undefined);
    }

    async getAllTools(): Promise<McpTool[]> {
        const allTools: McpTool[] = [];
        let cursor: string | undefined;

        do {
            const result = await this.listTools(cursor);
            allTools.push(...result.tools);
            cursor = result.nextCursor;
        } while (cursor);

        return allTools;
    }

    async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        const params: CallToolParams = {
            name,
            arguments: args,
        };

        return this.request<CallToolResult>('tools/call', params as unknown as Record<string, unknown>);
    }

    // =========================================================================
    // Resources (Optional)
    // =========================================================================

    async listResources(cursor?: string): Promise<ListResourcesResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        if (!this.serverCapabilities?.resources) {
            throw new Error('Server does not support resources');
        }

        return this.request<ListResourcesResult>('resources/list', cursor ? { cursor } : undefined);
    }

    async readResource(uri: string): Promise<ReadResourceResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        if (!this.serverCapabilities?.resources) {
            throw new Error('Server does not support resources');
        }

        const params: ReadResourceParams = { uri };
        return this.request<ReadResourceResult>('resources/read', params as unknown as Record<string, unknown>);
    }

    // =========================================================================
    // Prompts (Optional)
    // =========================================================================

    async listPrompts(cursor?: string): Promise<ListPromptsResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        if (!this.serverCapabilities?.prompts) {
            throw new Error('Server does not support prompts');
        }

        return this.request<ListPromptsResult>('prompts/list', cursor ? { cursor } : undefined);
    }

    async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }

        if (!this.serverCapabilities?.prompts) {
            throw new Error('Server does not support prompts');
        }

        const params: GetPromptParams = { name, arguments: args };
        return this.request<GetPromptResult>('prompts/get', params as unknown as Record<string, unknown>);
    }

    // =========================================================================
    // Capability Checks
    // =========================================================================

    hasToolsCapability(): boolean {
        return !!this.serverCapabilities?.tools;
    }

    hasResourcesCapability(): boolean {
        return !!this.serverCapabilities?.resources;
    }

    hasPromptsCapability(): boolean {
        return !!this.serverCapabilities?.prompts;
    }
}

// =============================================================================
// Client Pool (for managing multiple MCP connections)
// =============================================================================

export class McpClientPool {
    private clients: Map<string, McpClient> = new Map();

    async getClient(id: string, config: McpClientConfig): Promise<McpClient> {
        let client = this.clients.get(id);

        if (!client) {
            client = new McpClient(config);
            this.clients.set(id, client);
        }

        if (!client.isReady) {
            await client.connect();
        }

        return client;
    }

    getConnectedClient(id: string): McpClient | undefined {
        const client = this.clients.get(id);
        return client?.isReady ? client : undefined;
    }

    disconnectClient(id: string): void {
        const client = this.clients.get(id);
        if (client) {
            client.disconnect();
            this.clients.delete(id);
        }
    }

    disconnectAll(): void {
        for (const client of this.clients.values()) {
            client.disconnect();
        }
        this.clients.clear();
    }

    getConnectionStatus(): Record<string, McpConnection> {
        const status: Record<string, McpConnection> = {};
        for (const [id, client] of this.clients) {
            status[id] = client.connection;
        }
        return status;
    }
}

// Global client pool instance
export const mcpPool = new McpClientPool();
