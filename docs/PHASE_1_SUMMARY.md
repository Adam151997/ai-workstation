# Phase 1: Async Job Queue - Implementation Summary

## Overview
Implemented Trigger.dev integration for background job processing, enabling long-running workflows without Vercel's 60-second timeout.

## Files Created

### Trigger.dev Jobs
| File | Description |
|------|-------------|
| `trigger/client.ts` | Trigger.dev client config and type definitions |
| `trigger/workflow-execution.ts` | Background workflow execution job |
| `trigger/bulk-document.ts` | Bulk document processing + reprocessing jobs |
| `trigger/index.ts` | Job exports |

### API Endpoints
| File | Description |
|------|-------------|
| `app/api/jobs/route.ts` | Trigger jobs and check status |
| `app/api/workflow/update-step/route.ts` | Internal callback for step updates |
| `app/api/workflow/update-execution/route.ts` | Internal callback for execution updates |

### Frontend
| File | Description |
|------|-------------|
| `hooks/useBackgroundJobs.ts` | React hook for job management |
| `components/BackgroundJobsPanel.tsx` | UI for viewing job progress |

## Installation Required

```bash
# Install Trigger.dev SDK
npm install @trigger.dev/sdk

# Initialize (creates trigger.config.ts)
npx trigger.dev@latest init
```

## Environment Variables

Add to `.env.local`:
```env
TRIGGER_SECRET_KEY=tr_dev_xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Job Types

### 1. Workflow Execution (`workflow-execution`)
Runs multi-step workflows in the background:
- No timeout limits
- Progress tracking per step
- Automatic retries (3x)
- Audit logging

**Trigger:**
```typescript
const result = await fetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
        jobType: 'workflow',
        payload: {
            workflowName: 'Process Sales Data',
            workflowDescription: 'Analyze and process sales data',
            steps: [
                { name: 'Fetch Data', description: 'Get data from HubSpot', tool: 'HUBSPOT_GET_CONTACTS' },
                { name: 'Analyze', description: 'Analyze the data' },
                { name: 'Report', description: 'Generate report' },
            ],
            mode: 'Sales',
            modelId: 'gpt-4o',
        },
    }),
});
```

### 2. Bulk Document Processing (`bulk-document-processing`)
Process many documents in parallel:
- Batch processing (5 at a time)
- Progress updates
- Handles failures gracefully

**Trigger:**
```typescript
const result = await fetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
        jobType: 'bulk-documents',
        payload: {
            documents: [
                { id: 'doc1', filename: 'report.pdf', fileType: 'pdf', fileSize: 1024000 },
                { id: 'doc2', filename: 'contract.docx', fileType: 'docx', fileSize: 512000 },
            ],
            projectId: 'project-123',
            tags: ['important', 'legal'],
            mode: 'Admin',
        },
    }),
});
```

### 3. Document Reprocessing (`document-reprocessing`)
Re-index documents with new settings:

**Trigger:**
```typescript
const result = await fetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({
        jobType: 'document-reprocess',
        payload: {
            documentIds: ['doc1', 'doc2', 'doc3'],
            newChunkSize: 500,
            newOverlap: 100,
            mode: 'Sales',
        },
    }),
});
```

## Check Job Status

```typescript
// Get specific job status
const status = await fetch('/api/jobs?type=workflow&jobId=execution-123');

// Get all running jobs
const running = await fetch('/api/jobs');
```

## React Hook Usage

```tsx
import { useBackgroundJobs } from '@/hooks/useBackgroundJobs';

function MyComponent() {
    const { 
        jobs, 
        triggerWorkflowJob, 
        hasRunningJobs,
        isLoading 
    } = useBackgroundJobs();

    const handleStartWorkflow = async () => {
        await triggerWorkflowJob({
            workflowName: 'My Workflow',
            workflowDescription: 'Does something useful',
            steps: [...],
            mode: 'Sales',
            modelId: 'gpt-4o',
        });
    };

    return (
        <div>
            {hasRunningJobs && <span>Jobs running...</span>}
            <button onClick={handleStartWorkflow}>Start Workflow</button>
        </div>
    );
}
```

## UI Component Usage

```tsx
import { BackgroundJobsPanel } from '@/components/BackgroundJobsPanel';

// Full view
<BackgroundJobsPanel />

// Compact (hides when no jobs)
<BackgroundJobsPanel compact />
```

## Architecture

```
User Action
    ↓
POST /api/jobs
    ↓
Create DB Records (workflow_executions, workflow_steps)
    ↓
Trigger.dev Job Queue
    ↓
Background Worker Executes Steps
    ↓
Callbacks to /api/workflow/update-step
    ↓
Callbacks to /api/workflow/update-execution
    ↓
PostgreSQL Updated
    ↓
Frontend Polls for Updates
```

## Next Steps

1. **Install Trigger.dev:** `npm install @trigger.dev/sdk`
2. **Initialize:** `npx trigger.dev@latest init`
3. **Configure:** Add API keys to `.env.local`
4. **Start dev server:** `npx trigger.dev@latest dev`
5. **Test:** Trigger a workflow from the UI

## Benefits

- ✅ No 60-second timeout limit
- ✅ Real-time progress tracking
- ✅ Automatic retries with exponential backoff
- ✅ Full audit trail in PostgreSQL
- ✅ Scalable (runs on Trigger.dev infrastructure)
- ✅ Works with existing ObservabilityDashboard

---
Generated: Phase 1 - AI Workstation Enterprise Evolution
