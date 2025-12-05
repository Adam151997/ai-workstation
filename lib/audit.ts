// lib/audit.ts
// Centralized audit logging utility

import { query } from '@/lib/db';

export type AuditAction = 
    // Document actions
    | 'document.upload'
    | 'document.update'
    | 'document.delete'
    | 'document.view'
    | 'document.download'
    // Chat actions
    | 'chat.message'
    | 'chat.tool_call'
    // Project actions
    | 'project.create'
    | 'project.update'
    | 'project.delete'
    | 'project.archive'
    // Tag actions
    | 'tag.create'
    | 'tag.update'
    | 'tag.delete'
    // Data source actions
    | 'datasource.connect'
    | 'datasource.disconnect'
    | 'datasource.sync'
    // Settings actions
    | 'settings.tools_update'
    | 'settings.update'
    // User actions
    | 'user.login'
    | 'user.logout'
    // Search actions
    | 'search.query'
    | 'rag.search'
    // Artifact actions
    | 'artifact.create'
    | 'artifact.export';

export type AuditResource = 
    | 'document'
    | 'chat'
    | 'project'
    | 'tag'
    | 'datasource'
    | 'settings'
    | 'user'
    | 'search'
    | 'artifact'
    | 'tool';

interface AuditLogParams {
    userId: string;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
    const {
        userId,
        action,
        resource,
        resourceId,
        metadata = {},
        ipAddress = 'unknown',
        userAgent = 'unknown',
    } = params;

    try {
        // Note: action_type and action_details are required by the original schema
        // We use 'action' for the new general-purpose field and populate legacy fields too
        await query(
            `INSERT INTO audit_logs (
                user_id, action, resource, resource_id, metadata, ip_address, user_agent,
                action_type, action_details, tokens_used, cost, success
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                userId,
                action,
                resource,
                resourceId || null,
                JSON.stringify(metadata),
                ipAddress,
                userAgent,
                // Legacy required fields
                action.split('.')[1] || action, // action_type: 'upload', 'create', etc.
                `${action} on ${resource}${resourceId ? ` (${resourceId})` : ''}`, // action_details
                0, // tokens_used
                0, // cost
                true, // success
            ]
        );
        console.log(`[Audit] ✅ Logged: ${action} on ${resource}${resourceId ? ` (${resourceId})` : ''}`);
    } catch (error) {
        // Don't throw - audit logging should never break the main flow
        console.error('[Audit] ❌ Failed to log:', error);
    }
}

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMeta(req: Request): { ipAddress: string; userAgent: string } {
    const headers = req.headers;
    
    const ipAddress = 
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        'unknown';
    
    const userAgent = headers.get('user-agent') || 'unknown';
    
    return { ipAddress, userAgent };
}

/**
 * Convenience function to log document actions
 */
export async function logDocumentAction(
    userId: string,
    action: 'document.upload' | 'document.update' | 'document.delete' | 'document.view' | 'document.download',
    documentId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'document',
        resourceId: documentId,
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log chat actions
 */
export async function logChatAction(
    userId: string,
    action: 'chat.message' | 'chat.tool_call',
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'chat',
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log project actions
 */
export async function logProjectAction(
    userId: string,
    action: 'project.create' | 'project.update' | 'project.delete' | 'project.archive',
    projectId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'project',
        resourceId: projectId,
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log tag actions
 */
export async function logTagAction(
    userId: string,
    action: 'tag.create' | 'tag.update' | 'tag.delete',
    tagId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'tag',
        resourceId: tagId,
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log settings actions
 */
export async function logSettingsAction(
    userId: string,
    action: 'settings.tools_update' | 'settings.update',
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'settings',
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log search/RAG actions
 */
export async function logSearchAction(
    userId: string,
    action: 'search.query' | 'rag.search',
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'search',
        metadata,
        ...requestMeta,
    });
}

/**
 * Convenience function to log artifact actions
 */
export async function logArtifactAction(
    userId: string,
    action: 'artifact.create' | 'artifact.export',
    artifactId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'artifact',
        resourceId: artifactId,
        metadata,
        ...requestMeta,
    });
}

export default createAuditLog;
