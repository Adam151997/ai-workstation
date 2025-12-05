// config/mcp-configs.ts
// Maps each mode to its Composio MCP server configuration

export interface MCPConfig {
    mcpConfigId: string;
    externalUserId: string;
    mcpServerId: string;
    httpEndpoint: string;
    apiKey: string;
}

export const MCP_CONFIGS: Record<string, MCPConfig> = {
    'Sales': {
        mcpConfigId: 'bed03613-e48b-4c7f-9ed4-7dd139b133b7',
        externalUserId: 'pg-test-5dcb9e5a-93c1-485e-928c-633d4dd07e32',
        mcpServerId: '3671a639-b9a1-4d0e-b3ce-2a22f2f3eecc',
        httpEndpoint: 'https://backend.composio.dev/v3/mcp/bed03613-e48b-4c7f-9ed4-7dd139b133b7/mcp',
        apiKey: process.env.COMPOSIO_MCP_API_KEY || 'ak_clEjBdTaP4-gf06fOsMK',
    },
    'Marketing': {
        mcpConfigId: '4a306fd4-0b96-47f6-a73d-ee446df7b7d7',
        externalUserId: 'pg-test-5dcb9e5a-93c1-485e-928c-633d4dd07e32',
        mcpServerId: '9e04e312-860f-4e2a-9b16-cd3afa5aef6d',
        httpEndpoint: 'https://backend.composio.dev/v3/mcp/4a306fd4-0b96-47f6-a73d-ee446df7b7d7/mcp',
        apiKey: process.env.COMPOSIO_MCP_API_KEY || 'ak_clEjBdTaP4-gf06fOsMK',
    },
    'Admin': {
        mcpConfigId: '9669a149-6761-4676-9412-1ff8ee817ea0',
        externalUserId: 'pg-test-5dcb9e5a-93c1-485e-928c-633d4dd07e32',
        mcpServerId: 'ac4698ea-9e5d-47c9-a498-11f86b6b46b0',
        httpEndpoint: 'https://backend.composio.dev/v3/mcp/9669a149-6761-4676-9412-1ff8ee817ea0/mcp',
        apiKey: process.env.COMPOSIO_MCP_API_KEY || 'ak_clEjBdTaP4-gf06fOsMK',
    },
};

export type Mode = 'Sales' | 'Marketing' | 'Admin';
