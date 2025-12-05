# Phase 4: ETL Pipelines - Implementation Summary

## Overview
Implemented ETL (Extract, Transform, Load) pipeline infrastructure for bulk data ingestion from external sources like Google Drive, Gmail, Notion, Slack, Dropbox, and OneDrive.

## Files Created

### Database Migration
| File | Description |
|------|-------------|
| `migrations/006_etl_pipelines.sql` | Full SQL migration |
| `app/api/setup/etl-pipelines/route.ts` | Migration endpoint |

### API Endpoints
| File | Description |
|------|-------------|
| `app/api/data-sources/route.ts` | CRUD for data source connections |
| `app/api/data-sources/sync/route.ts` | Trigger and monitor sync jobs |

### Background Jobs
| File | Description |
|------|-------------|
| `trigger/etl-sync.ts` | ETL sync jobs for Trigger.dev |

## Run Migration

```bash
curl http://localhost:3000/api/setup/etl-pipelines
```

## Database Schema

```
data_sources
├── id (UUID)
├── user_id
├── name
├── source_type (google_drive, gmail, notion, slack, dropbox, onedrive)
├── connection_status (connected, disconnected, error, syncing)
├── auth_data (JSONB - encrypted tokens)
├── config (JSONB)
├── last_sync_at
├── last_sync_status
├── total_items_synced
├── sync_frequency (manual, hourly, daily, weekly)
├── is_active
└── timestamps

sync_jobs
├── id (UUID)
├── user_id
├── data_source_id (FK)
├── job_type (full_sync, incremental, delta, manual)
├── status (pending, running, completed, failed, cancelled)
├── items_found/processed/created/updated/skipped/failed
├── bytes_processed
├── error_message
├── progress_data (JSONB - for resumable syncs)
└── timestamps

sync_items
├── id (UUID)
├── user_id
├── data_source_id (FK)
├── external_id (unique per source)
├── external_path
├── item_type (file, email, message, page, note)
├── external_modified_at
├── external_hash (for change detection)
├── local_document_id (FK to documents)
├── sync_status
└── timestamps

etl_transformations
├── id (UUID)
├── user_id
├── name
├── source_type
├── transformation_type
├── config (JSONB)
├── execution_order
└── timestamps

scheduled_syncs
├── id (UUID)
├── user_id
├── data_source_id (FK)
├── schedule_type (cron, interval, daily, weekly)
├── schedule_config (JSONB)
├── next_run_at
├── last_run_at
└── timestamps
```

## API Usage

### Data Sources

```typescript
// List data sources
GET /api/data-sources

// Create data source
POST /api/data-sources
{
    "name": "My Google Drive",
    "sourceType": "google_drive",
    "config": { "folderId": "..." },
    "syncFrequency": "daily"
}

// Update data source
PUT /api/data-sources
{ "id": "...", "syncFrequency": "hourly" }

// Delete data source
DELETE /api/data-sources?id=...
```

### Sync Jobs

```typescript
// List sync jobs
GET /api/data-sources/sync?dataSourceId=...

// Start sync
POST /api/data-sources/sync
{
    "dataSourceId": "...",
    "jobType": "incremental"
}

// Cancel sync
DELETE /api/data-sources/sync?jobId=...
```

## Supported Source Types

| Source | Status | Composio Tools |
|--------|--------|----------------|
| Google Drive | Placeholder | GOOGLEDRIVE_LIST_FILES, GOOGLEDRIVE_GET_FILE |
| Gmail | Placeholder | GMAIL_LIST_MESSAGES, GMAIL_GET_MESSAGE |
| Notion | Placeholder | NOTION_SEARCH, NOTION_GET_PAGE |
| Slack | Placeholder | SLACK_LIST_CHANNELS, SLACK_LIST_MESSAGES |
| Dropbox | Placeholder | DROPBOX_LIST_FOLDER, DROPBOX_DOWNLOAD |
| OneDrive | Placeholder | Microsoft Graph API |

## Sync Flow

```
1. User creates data_source
2. User connects via OAuth (Composio)
3. User triggers sync (manual or scheduled)
4. sync_job created with status='running'
5. ETL job discovers items in source
6. For each item:
   a. Check if exists in sync_items
   b. Compare hash/modifiedAt for changes
   c. Download if new/changed
   d. Process and create document
   e. Generate embeddings
   f. Update sync_items record
7. Update sync_job with results
8. Update data_source with last_sync info
```

## Delta Sync

The system supports efficient delta syncing:
- `sync_items` tracks all synced items
- `external_hash` and `external_modified_at` detect changes
- Only new/modified items are processed on subsequent syncs

## Security

All ETL tables have Row-Level Security enabled:
- Users can only see their own data sources
- Users can only see their own sync jobs
- Users can only see their own sync items

## Integration with Existing Systems

- **Documents**: Synced items create entries in `documents` table
- **RAG**: Synced documents are embedded in Pinecone
- **Projects**: Synced items can be assigned to projects
- **Tags**: Synced items can be tagged

## Next Steps

1. Run the migration
2. Implement OAuth flows for each source via Composio
3. Implement actual sync logic using Composio tools
4. Add scheduled sync worker
5. Add UI for data source management

---
Generated: Phase 4 - AI Workstation Enterprise Evolution
