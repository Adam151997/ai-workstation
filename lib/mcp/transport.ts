// lib/mcp/transport.ts
// MCP Transport Layer - HTTP/SSE Implementation

import {
    JsonRpcRequest,
    JsonRpcResponse,
    JsonRpcNotification,
    McpTransport,
} from './types';

export interface TransportConfig {
    url: string;
    headers?: Record<string, string>;
    timeout?: number;
}

export interface Transport {
    send(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null>;
    close(): void;
    onMessage?: (message: JsonRpcResponse | JsonRpcNotification) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
}

// =============================================================================
// HTTP Transport (Request/Response)
// =============================================================================

export class HttpTransport implements Transport {
    private config: TransportConfig;
    private requestId = 0;
    
    onMessage?: (message: JsonRpcResponse | JsonRpcNotification) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;

    constructor(config: TransportConfig) {
        this.config = config;
    }

    async send(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null> {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            this.config.timeout || 30000
        );

        try {
            const response = await fetch(this.config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.config.headers,
                },
                body: JSON.stringify(message),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Notifications don't expect a response
            if (!('id' in message)) {
                return null;
            }

            const result = await response.json();
            return result as JsonRpcResponse;

        } catch (error: any) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    close(): void {
        if (this.onClose) {
            this.onClose();
        }
    }
}

// =============================================================================
// SSE Transport (Server-Sent Events for streaming)
// =============================================================================

export class SseTransport implements Transport {
    private config: TransportConfig;
    private eventSource: EventSource | null = null;
    private pendingRequests: Map<string | number, {
        resolve: (value: JsonRpcResponse) => void;
        reject: (error: Error) => void;
    }> = new Map();
    private requestId = 0;
    
    onMessage?: (message: JsonRpcResponse | JsonRpcNotification) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;

    constructor(config: TransportConfig) {
        this.config = config;
    }

    connect(): void {
        // SSE endpoint for receiving messages
        const sseUrl = new URL(this.config.url);
        sseUrl.pathname = sseUrl.pathname.replace(/\/?$/, '/sse');
        
        this.eventSource = new EventSource(sseUrl.toString());

        this.eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // Check if this is a response to a pending request
                if ('id' in message && this.pendingRequests.has(message.id)) {
                    const pending = this.pendingRequests.get(message.id)!;
                    this.pendingRequests.delete(message.id);
                    
                    if (message.error) {
                        pending.reject(new Error(message.error.message));
                    } else {
                        pending.resolve(message);
                    }
                } else if (this.onMessage) {
                    this.onMessage(message);
                }
            } catch (error) {
                console.error('[SSE] Failed to parse message:', error);
            }
        };

        this.eventSource.onerror = (event) => {
            if (this.onError) {
                this.onError(new Error('SSE connection error'));
            }
        };
    }

    async send(message: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse | null> {
        // Send via HTTP POST, receive response via SSE or inline
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            this.config.timeout || 30000
        );

        try {
            const response = await fetch(this.config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.config.headers,
                },
                body: JSON.stringify(message),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Notifications don't expect a response
            if (!('id' in message)) {
                return null;
            }

            // Check if response is SSE or JSON
            const contentType = response.headers.get('content-type') || '';
            
            if (contentType.includes('text/event-stream')) {
                // Response will come via SSE
                return new Promise((resolve, reject) => {
                    this.pendingRequests.set(message.id, { resolve, reject });
                    
                    // Timeout for SSE response
                    setTimeout(() => {
                        if (this.pendingRequests.has(message.id)) {
                            this.pendingRequests.delete(message.id);
                            reject(new Error('SSE response timeout'));
                        }
                    }, this.config.timeout || 30000);
                });
            } else {
                // Direct JSON response
                const result = await response.json();
                return result as JsonRpcResponse;
            }

        } catch (error: any) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    close(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
            pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
        
        if (this.onClose) {
            this.onClose();
        }
    }
}

// =============================================================================
// Transport Factory
// =============================================================================

export function createTransport(
    type: McpTransport,
    config: TransportConfig
): Transport {
    switch (type) {
        case 'http':
            return new HttpTransport(config);
        case 'sse':
            const transport = new SseTransport(config);
            transport.connect();
            return transport;
        default:
            // Default to HTTP for unsupported transports
            console.warn(`[MCP] Unsupported transport "${type}", falling back to HTTP`);
            return new HttpTransport(config);
    }
}
