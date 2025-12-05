// trigger/index.ts
// Export all Trigger.dev jobs
// NOTE: All tasks use HTTP calls only - no direct library imports to avoid build issues

// Workflow execution jobs
export { workflowExecutionJob } from "./workflow-execution";

// Document processing jobs
export { 
    bulkDocumentProcessingJob,
    documentReprocessingJob,
} from "./bulk-document";

// Bulk document processor (alternative implementation)
export { processBulkDocuments } from "./bulk-document-processor";

// Artifact generation
export { generateArtifact } from "./artifact-generation";

// ETL sync jobs
export {
    etlSyncJob,
    googleDriveSyncJob,
    gmailSyncJob,
    notionSyncJob,
} from "./etl-sync";

// Re-export types only (no runtime imports)
export type {
    JobStatus,
    JobMetadata,
    WorkflowJobPayload,
    BulkDocumentJobPayload,
} from "./client";
