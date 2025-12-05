// trigger/client.ts
// Trigger.dev v4 type definitions
// Note: v4 doesn't use TriggerClient - tasks are defined directly

// Job status types
export type JobStatus = 
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled';

// Common job metadata
export interface JobMetadata {
    userId: string;
    mode: 'Sales' | 'Marketing' | 'Admin';
    modelId: string;
    startedAt: string;
}

// Workflow job payload
export interface WorkflowJobPayload {
    executionId: string;
    workflowName: string;
    workflowDescription: string;
    steps: Array<{
        name: string;
        description: string;
        tool?: string;
        parameters?: Record<string, any>;
    }>;
    metadata: JobMetadata;
}

// Bulk document job payload
export interface BulkDocumentJobPayload {
    documents: Array<{
        id: string;
        filename: string;
        fileType: string;
        fileSize: number;
    }>;
    projectId?: string;
    tags?: string[];
    metadata: JobMetadata;
}

// ETL sync job payload
export interface ETLSyncJobPayload {
    syncJobId: string;
    sourceType: 'google_drive' | 'gmail' | 'notion' | 'slack';
    sourceConfig: Record<string, any>;
    deltaOnly: boolean;
    metadata: JobMetadata;
}
