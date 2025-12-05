// lib/db/store.ts
// ====================================================================
// MIGRATION NOTICE - Phase 0: Foundation Solidification
// ====================================================================
// This file previously contained an in-memory workflow store.
// It has been replaced with PostgreSQL persistence.
//
// The workflowStore is now re-exported from './workflow-store' which
// uses PostgreSQL for persistent storage.
//
// This change ensures:
// - Data persists across server restarts
// - Production-ready reliability
// - Full audit trail preservation
// - Billing records are not lost
// ====================================================================

// Re-export the PostgreSQL-backed store for backward compatibility
export { workflowStore, PostgresWorkflowStore } from './workflow-store';

// Re-export schema types
export type {
    WorkflowExecution,
    WorkflowStep,
    AuditLog,
    ObservabilityMetrics,
    BillingRecord,
} from './schema';
