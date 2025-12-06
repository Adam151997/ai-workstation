// lib/etl/connectors.ts
// ETL Connectors - Actual implementations for external data sources
// Uses Composio MCP for OAuth and API calls

import { ComposioMCPClient } from '@/lib/composio-mcp-dynamic';
import { query } from '@/lib/db';

// =============================================================================
// Types
// =============================================================================

export interface DiscoveredItem {
    externalId: string;
    name: string;
    path?: string;
    mimeType?: string;
    fileSize?: number;
    modifiedAt?: string;
    hash?: string;
    metadata?: Record<string, any>;
}

export interface ProcessedItem {
    action: 'created' | 'updated' | 'skipped';
    documentId?: string;
    error?: string;
}

export interface ConnectorConfig {
    userId: string;
    dataSourceId: string;
    sourceType: string;
    config: Record<string, any>;
}

// =============================================================================
// Base Connector Class
// =============================================================================

export abstract class BaseConnector {
    protected userId: string;
    protected dataSourceId: string;
    protected config: Record<string, any>;
    protected mcpClient: ComposioMCPClient;

    constructor(connectorConfig: ConnectorConfig) {
        this.userId = connectorConfig.userId;
        this.dataSourceId = connectorConfig.dataSourceId;
        this.config = connectorConfig.config;
        
        // Initialize MCP client with user's tools
        this.mcpClient = new ComposioMCPClient('General', this.userId, []);
    }

    abstract discover(): Promise<DiscoveredItem[]>;
    abstract fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }>;
    abstract getToolPrefix(): string;

    /**
     * Process a single item - download, extract text, create document
     */
    async processItem(item: DiscoveredItem): Promise<ProcessedItem> {
        try {
            // Check if already synced
            const existing = await query(`
                SELECT id, external_hash, local_document_id 
                FROM sync_items 
                WHERE data_source_id = $1 AND external_id = $2
            `, [this.dataSourceId, item.externalId]);

            // Skip if hash matches (no changes)
            if (existing.length > 0 && existing[0].external_hash === item.hash) {
                return { action: 'skipped' };
            }

            // Fetch content
            const { content, mimeType } = await this.fetchContent(item);

            if (!content || content.length < 10) {
                return { action: 'skipped' };
            }

            // Create or update document
            let documentId: string;
            let action: 'created' | 'updated';

            if (existing.length > 0 && existing[0].local_document_id) {
                // Update existing document
                documentId = existing[0].local_document_id;
                await query(`
                    UPDATE documents 
                    SET file_data = $1, file_size = $2, uploaded_at = NOW()
                    WHERE id = $3
                `, [Buffer.from(content), content.length, documentId]);
                action = 'updated';
            } else {
                // Create new document
                const result = await query(`
                    INSERT INTO documents (user_id, filename, file_type, file_size, file_data, mode, source_type)
                    VALUES ($1, $2, $3, $4, $5, 'General', 'etl')
                    RETURNING id
                `, [
                    this.userId,
                    item.name,
                    mimeType,
                    content.length,
                    Buffer.from(content),
                ]);
                documentId = result[0].id;
                action = 'created';
            }

            // Update sync_items record
            await query(`
                INSERT INTO sync_items (
                    user_id, data_source_id, external_id, external_path, 
                    item_type, item_name, mime_type, file_size,
                    external_modified_at, external_hash, local_document_id,
                    sync_status, last_synced_at, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'synced', NOW(), $12)
                ON CONFLICT (data_source_id, external_id) 
                DO UPDATE SET
                    external_hash = EXCLUDED.external_hash,
                    external_modified_at = EXCLUDED.external_modified_at,
                    local_document_id = EXCLUDED.local_document_id,
                    sync_status = 'synced',
                    last_synced_at = NOW()
            `, [
                this.userId,
                this.dataSourceId,
                item.externalId,
                item.path,
                'file',
                item.name,
                mimeType,
                item.fileSize,
                item.modifiedAt,
                item.hash,
                documentId,
                JSON.stringify(item.metadata || {}),
            ]);

            console.log(`[ETL] ✅ ${action}: ${item.name}`);
            return { action, documentId };

        } catch (error: any) {
            console.error(`[ETL] ❌ Failed to process ${item.name}:`, error.message);
            
            // Log failure in sync_items
            await query(`
                INSERT INTO sync_items (
                    user_id, data_source_id, external_id, item_name,
                    sync_status, sync_error, metadata
                ) VALUES ($1, $2, $3, $4, 'failed', $5, '{}')
                ON CONFLICT (data_source_id, external_id) 
                DO UPDATE SET sync_status = 'failed', sync_error = EXCLUDED.sync_error
            `, [this.userId, this.dataSourceId, item.externalId, item.name, error.message]);

            return { action: 'skipped', error: error.message };
        }
    }
}

// =============================================================================
// Google Drive Connector
// =============================================================================

export class GoogleDriveConnector extends BaseConnector {
    getToolPrefix() { return 'GOOGLEDRIVE'; }

    async discover(): Promise<DiscoveredItem[]> {
        try {
            console.log('[GoogleDrive] Discovering files...');
            
            // Use Composio MCP to list files
            const result = await this.mcpClient.executeTool('GOOGLEDRIVE_LIST_FILES', {
                pageSize: 100,
                q: this.config.query || "mimeType != 'application/vnd.google-apps.folder'",
                fields: 'files(id,name,mimeType,size,modifiedTime,md5Checksum,webViewLink)',
            });

            if (!result || !result.files) {
                console.log('[GoogleDrive] No files returned');
                return [];
            }

            const items: DiscoveredItem[] = result.files.map((file: any) => ({
                externalId: file.id,
                name: file.name,
                path: file.webViewLink,
                mimeType: file.mimeType,
                fileSize: parseInt(file.size) || 0,
                modifiedAt: file.modifiedTime,
                hash: file.md5Checksum,
                metadata: { driveFile: true },
            }));

            console.log(`[GoogleDrive] Discovered ${items.length} files`);
            return items;

        } catch (error: any) {
            console.error('[GoogleDrive] Discovery failed:', error.message);
            return [];
        }
    }

    async fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }> {
        try {
            // Handle Google Docs - export as plain text
            if (item.mimeType?.includes('google-apps.document')) {
                const result = await this.mcpClient.executeTool('GOOGLEDRIVE_EXPORT_FILE', {
                    fileId: item.externalId,
                    mimeType: 'text/plain',
                });
                return { content: result.content || '', mimeType: 'text/plain' };
            }

            // Handle Google Sheets - export as CSV
            if (item.mimeType?.includes('google-apps.spreadsheet')) {
                const result = await this.mcpClient.executeTool('GOOGLEDRIVE_EXPORT_FILE', {
                    fileId: item.externalId,
                    mimeType: 'text/csv',
                });
                return { content: result.content || '', mimeType: 'text/csv' };
            }

            // Handle regular files - download
            const result = await this.mcpClient.executeTool('GOOGLEDRIVE_DOWNLOAD_FILE', {
                fileId: item.externalId,
            });

            // Extract text based on mime type
            const content = this.extractText(result.content, item.mimeType || 'text/plain');
            return { content, mimeType: item.mimeType || 'text/plain' };

        } catch (error: any) {
            console.error(`[GoogleDrive] Failed to fetch ${item.name}:`, error.message);
            return { content: '', mimeType: 'text/plain' };
        }
    }

    private extractText(content: any, mimeType: string): string {
        if (typeof content === 'string') return content;
        if (Buffer.isBuffer(content)) return content.toString('utf-8');
        return JSON.stringify(content);
    }
}

// =============================================================================
// Gmail Connector
// =============================================================================

export class GmailConnector extends BaseConnector {
    getToolPrefix() { return 'GMAIL'; }

    async discover(): Promise<DiscoveredItem[]> {
        try {
            console.log('[Gmail] Discovering emails...');

            const result = await this.mcpClient.executeTool('GMAIL_LIST_MESSAGES', {
                maxResults: this.config.maxEmails || 50,
                q: this.config.query || 'is:inbox',
            });

            if (!result || !result.messages) {
                console.log('[Gmail] No messages returned');
                return [];
            }

            // Get message details
            const items: DiscoveredItem[] = [];
            
            for (const msg of result.messages.slice(0, 50)) {
                try {
                    const detail = await this.mcpClient.executeTool('GMAIL_GET_MESSAGE', {
                        messageId: msg.id,
                        format: 'metadata',
                    });

                    const headers = detail.payload?.headers || [];
                    const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
                    const date = headers.find((h: any) => h.name === 'Date')?.value;

                    items.push({
                        externalId: msg.id,
                        name: subject,
                        modifiedAt: date,
                        hash: msg.threadId,
                        metadata: { 
                            threadId: msg.threadId,
                            labelIds: detail.labelIds,
                        },
                    });
                } catch (e) {
                    // Skip failed message
                }
            }

            console.log(`[Gmail] Discovered ${items.length} emails`);
            return items;

        } catch (error: any) {
            console.error('[Gmail] Discovery failed:', error.message);
            return [];
        }
    }

    async fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }> {
        try {
            const result = await this.mcpClient.executeTool('GMAIL_GET_MESSAGE', {
                messageId: item.externalId,
                format: 'full',
            });

            // Extract email body
            let body = '';
            
            if (result.payload?.body?.data) {
                body = Buffer.from(result.payload.body.data, 'base64').toString('utf-8');
            } else if (result.payload?.parts) {
                for (const part of result.payload.parts) {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        body += Buffer.from(part.body.data, 'base64').toString('utf-8');
                    }
                }
            }

            // Format as document
            const headers = result.payload?.headers || [];
            const from = headers.find((h: any) => h.name === 'From')?.value || '';
            const to = headers.find((h: any) => h.name === 'To')?.value || '';
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';

            const content = `From: ${from}\nTo: ${to}\nDate: ${date}\nSubject: ${item.name}\n\n${body}`;

            return { content, mimeType: 'text/plain' };

        } catch (error: any) {
            console.error(`[Gmail] Failed to fetch ${item.name}:`, error.message);
            return { content: '', mimeType: 'text/plain' };
        }
    }
}

// =============================================================================
// Notion Connector
// =============================================================================

export class NotionConnector extends BaseConnector {
    getToolPrefix() { return 'NOTION'; }

    async discover(): Promise<DiscoveredItem[]> {
        try {
            console.log('[Notion] Discovering pages...');

            const result = await this.mcpClient.executeTool('NOTION_SEARCH', {
                query: this.config.query || '',
                filter: { property: 'object', value: 'page' },
                page_size: 100,
            });

            if (!result || !result.results) {
                console.log('[Notion] No pages returned');
                return [];
            }

            const items: DiscoveredItem[] = result.results.map((page: any) => {
                // Extract title
                let title = 'Untitled';
                if (page.properties?.title?.title?.[0]?.text?.content) {
                    title = page.properties.title.title[0].text.content;
                } else if (page.properties?.Name?.title?.[0]?.text?.content) {
                    title = page.properties.Name.title[0].text.content;
                }

                return {
                    externalId: page.id,
                    name: title,
                    path: page.url,
                    modifiedAt: page.last_edited_time,
                    hash: page.last_edited_time,
                    metadata: {
                        icon: page.icon,
                        cover: page.cover,
                    },
                };
            });

            console.log(`[Notion] Discovered ${items.length} pages`);
            return items;

        } catch (error: any) {
            console.error('[Notion] Discovery failed:', error.message);
            return [];
        }
    }

    async fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }> {
        try {
            const result = await this.mcpClient.executeTool('NOTION_GET_BLOCK_CHILDREN', {
                block_id: item.externalId,
                page_size: 100,
            });

            if (!result || !result.results) {
                return { content: '', mimeType: 'text/plain' };
            }

            const textParts: string[] = [`# ${item.name}\n`];

            for (const block of result.results) {
                const text = this.extractBlockText(block);
                if (text) textParts.push(text);
            }

            return { content: textParts.join('\n'), mimeType: 'text/markdown' };

        } catch (error: any) {
            console.error(`[Notion] Failed to fetch ${item.name}:`, error.message);
            return { content: '', mimeType: 'text/plain' };
        }
    }

    private extractBlockText(block: any): string {
        const type = block.type;
        const content = block[type];

        if (!content) return '';

        if (content.rich_text) {
            const text = content.rich_text.map((rt: any) => rt.plain_text).join('');
            
            switch (type) {
                case 'heading_1': return `# ${text}`;
                case 'heading_2': return `## ${text}`;
                case 'heading_3': return `### ${text}`;
                case 'bulleted_list_item': return `• ${text}`;
                case 'numbered_list_item': return `1. ${text}`;
                case 'to_do': return `- [${content.checked ? 'x' : ' '}] ${text}`;
                case 'quote': return `> ${text}`;
                case 'code': return `\`\`\`\n${text}\n\`\`\``;
                default: return text;
            }
        }

        return '';
    }
}

// =============================================================================
// Slack Connector
// =============================================================================

export class SlackConnector extends BaseConnector {
    getToolPrefix() { return 'SLACK'; }

    async discover(): Promise<DiscoveredItem[]> {
        try {
            console.log('[Slack] Discovering messages...');

            const channels = await this.mcpClient.executeTool('SLACK_LIST_CHANNELS', {
                limit: 100,
                types: 'public_channel,private_channel',
            });

            if (!channels || !channels.channels) {
                console.log('[Slack] No channels returned');
                return [];
            }

            const items: DiscoveredItem[] = [];
            const targetChannels = this.config.channels || channels.channels.slice(0, 10);

            for (const channel of targetChannels) {
                const channelId = channel.id || channel;
                const channelName = channel.name || channelId;

                try {
                    const history = await this.mcpClient.executeTool('SLACK_GET_CHANNEL_HISTORY', {
                        channel: channelId,
                        limit: this.config.messagesPerChannel || 100,
                    });

                    if (history?.messages) {
                        const today = new Date().toISOString().split('T')[0];
                        
                        items.push({
                            externalId: `${channelId}-${today}`,
                            name: `#${channelName} - ${today}`,
                            modifiedAt: new Date().toISOString(),
                            hash: history.messages.length.toString(),
                            metadata: {
                                channelId,
                                channelName,
                                messageCount: history.messages.length,
                                messages: history.messages,
                            },
                        });
                    }
                } catch (e) {
                    // Skip failed channel
                }
            }

            console.log(`[Slack] Discovered ${items.length} channel snapshots`);
            return items;

        } catch (error: any) {
            console.error('[Slack] Discovery failed:', error.message);
            return [];
        }
    }

    async fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }> {
        const messages = item.metadata?.messages || [];
        
        if (messages.length === 0) {
            return { content: '', mimeType: 'text/plain' };
        }

        const lines: string[] = [`# ${item.name}\n`];

        for (const msg of messages) {
            if (msg.text) {
                const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
                lines.push(`[${time}] ${msg.text}`);
            }
        }

        return { content: lines.join('\n'), mimeType: 'text/plain' };
    }
}

// =============================================================================
// Dropbox Connector
// =============================================================================

export class DropboxConnector extends BaseConnector {
    getToolPrefix() { return 'DROPBOX'; }

    async discover(): Promise<DiscoveredItem[]> {
        try {
            console.log('[Dropbox] Discovering files...');

            const result = await this.mcpClient.executeTool('DROPBOX_LIST_FOLDER', {
                path: this.config.path || '',
                recursive: this.config.recursive ?? true,
                limit: 100,
            });

            if (!result || !result.entries) {
                console.log('[Dropbox] No files returned');
                return [];
            }

            const items: DiscoveredItem[] = result.entries
                .filter((entry: any) => entry['.tag'] === 'file')
                .map((file: any) => ({
                    externalId: file.id,
                    name: file.name,
                    path: file.path_display,
                    fileSize: file.size,
                    modifiedAt: file.server_modified,
                    hash: file.content_hash,
                    metadata: { isDownloadable: file.is_downloadable },
                }));

            console.log(`[Dropbox] Discovered ${items.length} files`);
            return items;

        } catch (error: any) {
            console.error('[Dropbox] Discovery failed:', error.message);
            return [];
        }
    }

    async fetchContent(item: DiscoveredItem): Promise<{ content: string; mimeType: string }> {
        try {
            const result = await this.mcpClient.executeTool('DROPBOX_DOWNLOAD_FILE', {
                path: item.path,
            });

            const content = typeof result === 'string' ? result : JSON.stringify(result);
            return { content, mimeType: 'application/octet-stream' };

        } catch (error: any) {
            console.error(`[Dropbox] Failed to fetch ${item.name}:`, error.message);
            return { content: '', mimeType: 'text/plain' };
        }
    }
}

// =============================================================================
// Connector Factory
// =============================================================================

export function createConnector(config: ConnectorConfig): BaseConnector | null {
    switch (config.sourceType) {
        case 'google_drive':
            return new GoogleDriveConnector(config);
        case 'gmail':
            return new GmailConnector(config);
        case 'notion':
            return new NotionConnector(config);
        case 'slack':
            return new SlackConnector(config);
        case 'dropbox':
            return new DropboxConnector(config);
        default:
            console.warn(`[ETL] Unknown source type: ${config.sourceType}`);
            return null;
    }
}

// =============================================================================
// ETL Sync Function
// =============================================================================

export async function runETLSync(
    dataSourceId: string,
    userId: string,
    jobType: 'full_sync' | 'incremental' | 'delta' | 'manual' = 'manual'
): Promise<{
    itemsFound: number;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsSkipped: number;
    itemsFailed: number;
}> {
    const stats = {
        itemsFound: 0,
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        itemsFailed: 0,
    };

    try {
        // Get data source
        const sources = await query(`
            SELECT id, source_type, config 
            FROM data_sources 
            WHERE id = $1 AND user_id = $2
        `, [dataSourceId, userId]);

        if (sources.length === 0) {
            throw new Error('Data source not found');
        }

        const source = sources[0];
        const config: ConnectorConfig = {
            userId,
            dataSourceId,
            sourceType: source.source_type,
            config: source.config || {},
        };

        // Create connector
        const connector = createConnector(config);
        if (!connector) {
            throw new Error(`No connector for source type: ${source.source_type}`);
        }

        // Discover items
        console.log(`[ETL] Starting ${jobType} sync for ${source.source_type}...`);
        const items = await connector.discover();
        stats.itemsFound = items.length;

        if (items.length === 0) {
            console.log('[ETL] No items to sync');
            return stats;
        }

        // Process items
        for (const item of items) {
            const result = await connector.processItem(item);
            stats.itemsProcessed++;

            switch (result.action) {
                case 'created':
                    stats.itemsCreated++;
                    break;
                case 'updated':
                    stats.itemsUpdated++;
                    break;
                case 'skipped':
                    if (result.error) {
                        stats.itemsFailed++;
                    } else {
                        stats.itemsSkipped++;
                    }
                    break;
            }
        }

        console.log(`[ETL] Sync complete: ${stats.itemsCreated} created, ${stats.itemsUpdated} updated, ${stats.itemsSkipped} skipped, ${stats.itemsFailed} failed`);
        return stats;

    } catch (error: any) {
        console.error('[ETL] Sync failed:', error.message);
        throw error;
    }
}
