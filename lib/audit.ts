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
    | 'datasource.sync_complete'
    | 'datasource.sync_failed'
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
    | 'artifact.export'
    // Notebook actions (NEW)
    | 'notebook.create'
    | 'notebook.update'
    | 'notebook.delete'
    | 'notebook.cell_execute'
    | 'notebook.run_all'
    | 'notebook.run_complete'
    | 'notebook.run_failed'
    | 'notebook.share'
    | 'notebook.duplicate'
    // Toolkit actions (NEW)
    | 'toolkit.install'
    | 'toolkit.uninstall'
    | 'toolkit.configure'
    | 'toolkit.enable'
    | 'toolkit.disable'
    // Tool execution actions (NEW)
    | 'tool.execute'
    | 'tool.success'
    | 'tool.failed'
    // Workflow actions (NEW)
    | 'workflow.create'
    | 'workflow.update'
    | 'workflow.delete'
    | 'workflow.execute'
    | 'workflow.complete'
    | 'workflow.failed'
    | 'workflow.pause'
    | 'workflow.resume'
    // Agent actions (NEW)
    | 'agent.route'
    | 'agent.execute'
    | 'agent.delegate'
    // Memory actions (NEW)
    | 'memory.store'
    | 'memory.delete'
    | 'memory.consolidate';

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
    | 'tool'
    | 'notebook'    // NEW
    | 'toolkit'     // NEW
    | 'workflow'    // NEW
    | 'agent'       // NEW
    | 'memory';     // NEW

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
                metadata.tokens_used || 0, // tokens_used
                metadata.cost || 0, // cost
                metadata.success !== false, // success (default true)
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

// =============================================================================
// Document Actions
// =============================================================================

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

// =============================================================================
// Chat Actions
// =============================================================================

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

// =============================================================================
// Project Actions
// =============================================================================

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

// =============================================================================
// Tag Actions
// =============================================================================

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

// =============================================================================
// Settings Actions
// =============================================================================

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

// =============================================================================
// Search/RAG Actions
// =============================================================================

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

// =============================================================================
// Artifact Actions
// =============================================================================

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

// =============================================================================
// Notebook Actions (NEW)
// =============================================================================

export async function logNotebookAction(
    userId: string,
    action: 
        | 'notebook.create' 
        | 'notebook.update' 
        | 'notebook.delete' 
        | 'notebook.cell_execute'
        | 'notebook.run_all'
        | 'notebook.run_complete'
        | 'notebook.run_failed'
        | 'notebook.share'
        | 'notebook.duplicate',
    notebookId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'notebook',
        resourceId: notebookId,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Toolkit Actions (NEW)
// =============================================================================

export async function logToolkitAction(
    userId: string,
    action: 
        | 'toolkit.install' 
        | 'toolkit.uninstall' 
        | 'toolkit.configure'
        | 'toolkit.enable'
        | 'toolkit.disable',
    toolkitId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'toolkit',
        resourceId: toolkitId,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Tool Execution Actions (NEW)
// =============================================================================

export async function logToolAction(
    userId: string,
    action: 'tool.execute' | 'tool.success' | 'tool.failed',
    toolName: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'tool',
        resourceId: toolName,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Workflow Actions (NEW)
// =============================================================================

export async function logWorkflowAction(
    userId: string,
    action: 
        | 'workflow.create'
        | 'workflow.update'
        | 'workflow.delete'
        | 'workflow.execute'
        | 'workflow.complete'
        | 'workflow.failed'
        | 'workflow.pause'
        | 'workflow.resume',
    workflowId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'workflow',
        resourceId: workflowId,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Agent Actions (NEW)
// =============================================================================

export async function logAgentAction(
    userId: string,
    action: 'agent.route' | 'agent.execute' | 'agent.delegate',
    agentId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'agent',
        resourceId: agentId,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Memory Actions (NEW)
// =============================================================================

export async function logMemoryAction(
    userId: string,
    action: 'memory.store' | 'memory.delete' | 'memory.consolidate',
    memoryId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'memory',
        resourceId: memoryId,
        metadata,
        ...requestMeta,
    });
}

// =============================================================================
// Data Source Actions (NEW)
// =============================================================================

export async function logDataSourceAction(
    userId: string,
    action: 
        | 'datasource.connect'
        | 'datasource.disconnect'
        | 'datasource.sync'
        | 'datasource.sync_complete'
        | 'datasource.sync_failed',
    dataSourceId: string,
    metadata: Record<string, any> = {},
    req?: Request
) {
    const requestMeta = req ? extractRequestMeta(req) : {};
    await createAuditLog({
        userId,
        action,
        resource: 'datasource',
        resourceId: dataSourceId,
        metadata,
        ...requestMeta,
    });
}

export default createAuditLog;
