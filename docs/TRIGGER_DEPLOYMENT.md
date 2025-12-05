# Trigger.dev Cloud Deployment Guide

## Prerequisites

1. Node.js 18+ installed
2. Trigger.dev account at https://cloud.trigger.dev

---

## Step-by-Step Deployment

### 1. Login to Trigger.dev CLI

```bash
npx trigger.dev@latest login
```

This opens a browser for authentication.

---

### 2. Get Your API Keys

1. Go to https://cloud.trigger.dev
2. Select your project (or create new one)
3. Navigate to **Settings** → **API Keys**
4. Copy both keys:
   - **Development Key**: `tr_dev_xxxx` (for local testing)
   - **Production Key**: `tr_prod_xxxx` (for deployment)

---

### 3. Update Environment Variables

**Local Development (.env.local):**
```env
TRIGGER_SECRET_KEY=tr_dev_your_dev_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Vercel Production:**
Add these in Vercel Dashboard → Settings → Environment Variables:
```
TRIGGER_SECRET_KEY=tr_prod_your_prod_key_here
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

### 4. Test Locally with Dev Server

In one terminal:
```bash
npm run dev
```

In another terminal:
```bash
npx trigger.dev@latest dev
```

This connects your local tasks to Trigger.dev Cloud for testing.

---

### 5. Deploy to Production

```bash
npx trigger.dev@latest deploy
```

This will:
- Build your tasks
- Upload them to Trigger.dev Cloud
- Make them available for production use

---

### 6. Verify Deployment

1. Go to https://cloud.trigger.dev
2. Select your project
3. Navigate to **Runs** to see task executions
4. Check **Tasks** to see deployed tasks

---

## Your Deployed Tasks

| Task ID | Description |
|---------|-------------|
| `workflow-execution` | Long-running workflow execution |
| `bulk-document-processing` | Batch document processing |
| `document-reprocessing` | Re-index documents |
| `etl-sync` | External data sync |
| `google-drive-sync` | Google Drive sync |
| `gmail-sync` | Gmail sync |
| `notion-sync` | Notion sync |

---

## Triggering Tasks from Your App

```typescript
import { tasks } from "@trigger.dev/sdk/v3";
import { workflowExecutionJob } from "@/trigger";

// Trigger a task
const handle = await tasks.trigger("workflow-execution", {
    executionId: "exec_123",
    workflowName: "My Workflow",
    steps: [...],
    metadata: {
        userId: "user_123",
        mode: "Sales",
        modelId: "gpt-4",
        startedAt: new Date().toISOString(),
    },
});

// Get task status
const run = await tasks.retrieve(handle.id);
console.log(run.status); // "COMPLETED", "FAILED", etc.
```

---

## Monitoring & Logs

- **Dashboard**: https://cloud.trigger.dev
- **Real-time logs**: Available in the Runs tab
- **Metrics**: Task duration, success rate, retries

---

## Troubleshooting

### "Task not found" error
Run `npx trigger.dev@latest deploy` to upload latest tasks.

### "Unauthorized" error
Check that `TRIGGER_SECRET_KEY` matches your environment (dev vs prod).

### Callbacks failing
Ensure `NEXT_PUBLIC_APP_URL` is set correctly and accessible from the internet.

---

## Cost Estimation

**Free Tier**: 50,000 task runs/month

**Typical Usage**:
- Workflow execution: ~1 run per workflow
- Document processing: ~1 run per batch (up to 100 docs)
- ETL sync: ~4 runs/day per data source

For 100 workflows + 50 doc batches + 4 syncs/day:
≈ 100 + 50 + 120 = 270 runs/day ≈ 8,100/month (well within free tier)
