# Phase 2: Lightweight GraphRAG - Implementation Summary

## Overview
Implemented project and tag-based document organization with metadata-filtered vector search. This provides 80% of GraphRAG functionality with minimal complexity.

## Files Created

### Database Migration
| File | Description |
|------|-------------|
| `migrations/004_lightweight_graphrag.sql` | Full SQL migration |
| `app/api/setup/projects-tags/route.ts` | Migration endpoint |

### API Endpoints
| File | Description |
|------|-------------|
| `app/api/projects/route.ts` | CRUD for projects |
| `app/api/tags/route.ts` | CRUD for tags + document tagging |

### Updated Files
| File | Changes |
|------|---------|
| `lib/rag-helper.ts` | Project/tag filtering, query extraction |
| `lib/pinecone.ts` | Enhanced metadata, filtered queries |
| `app/api/documents/upload/route.ts` | Project/tag assignment on upload |

### UI Components
| File | Description |
|------|-------------|
| `components/projects/ProjectSelector.tsx` | Project dropdown with create |
| `components/projects/TagSelector.tsx` | Multi-tag selector with create |

## Database Schema

```
projects
├── id (UUID)
├── user_id
├── name
├── description
├── color (#hex)
├── icon (lucide icon name)
├── is_archived
├── document_count (auto-updated)
└── timestamps

tags
├── id (UUID)
├── user_id
├── name (unique per user)
├── color (#hex)
├── description
├── usage_count (auto-updated)
└── timestamps

document_tags
├── document_id (FK → documents)
├── tag_id (FK → tags)
└── created_at

documents
└── project_id (FK → projects) [NEW COLUMN]
```

## Run Migration

```bash
# Start dev server
npm run dev

# Run migration
curl http://localhost:3000/api/setup/projects-tags

# Verify
curl -X POST http://localhost:3000/api/setup/projects-tags
```

## API Usage

### Projects

```typescript
// List projects
GET /api/projects

// Create project
POST /api/projects
{ "name": "Alpha Project", "color": "#6366f1" }

// Update project
PUT /api/projects
{ "id": "...", "name": "Updated Name" }

// Delete project
DELETE /api/projects?id=...
```

### Tags

```typescript
// List all tags
GET /api/tags

// List tags for document
GET /api/tags?documentId=...

// Create tag (optionally attach to document)
POST /api/tags
{ "name": "urgent", "color": "#ef4444", "documentId": "..." }

// Remove tag from document
DELETE /api/tags?id=...&documentId=...

// Delete tag entirely
DELETE /api/tags?id=...
```

### Document Upload with Project/Tags

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('mode', 'Sales');
formData.append('projectId', 'project-uuid');
formData.append('tagIds', 'tag-uuid-1,tag-uuid-2');

await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
});
```

## RAG Filtering

### Query with Project Filter

```typescript
import { getRAGContext } from '@/lib/rag-helper';

const context = await getRAGContext(
    "What are the payment terms?",
    userId,
    mode,
    {
        projectId: "alpha-project-id",
        topK: 5,
    }
);
```

### Query with Tag Filter

```typescript
const context = await getRAGContext(
    "Show me urgent contracts",
    userId,
    mode,
    {
        tagNames: ["urgent", "contract"],
        topK: 5,
    }
);
```

### Natural Language Filter Extraction

```typescript
import { extractQueryFilters } from '@/lib/rag-helper';

const query = "What are the contracts from Alpha Project tagged urgent?";
const { projectName, tagNames, cleanedQuery } = extractQueryFilters(query);

// projectName: "Alpha Project"
// tagNames: ["urgent"]
// cleanedQuery: "What are the contracts?"
```

## UI Components Usage

### ProjectSelector

```tsx
import { ProjectSelector } from '@/components/projects/ProjectSelector';

<ProjectSelector
    selectedProjectId={projectId}
    onSelect={(id) => setProjectId(id)}
    allowAll={true}
    allowCreate={true}
/>
```

### TagSelector

```tsx
import { TagSelector } from '@/components/projects/TagSelector';

<TagSelector
    selectedTagIds={tagIds}
    onSelect={(ids) => setTagIds(ids)}
    allowCreate={true}
/>
```

## Benefits

1. **Project-Scoped RAG**: "Show me invoices from Alpha Project" only searches Alpha Project documents
2. **Tag-Filtered Search**: "Find urgent contracts" only returns documents tagged 'urgent'
3. **Automatic Metadata**: Project/tag info stored in Pinecone for fast filtering
4. **80/20 Rule**: Simple implementation provides most GraphRAG value

## Query Examples

| User Query | Extracted Filters |
|------------|-------------------|
| "from Alpha Project" | projectName: "Alpha Project" |
| "tagged urgent" | tagNames: ["urgent"] |
| "#contract" | tagNames: ["contract"] |
| "in Project X with tag Y" | projectName: "Project X", tagNames: ["Y"] |

## Next Steps

1. Run the migration
2. Test project/tag creation
3. Upload documents with project assignment
4. Test filtered RAG queries
5. Proceed to Phase 3 (Row-Level Security)

---
Generated: Phase 2 - AI Workstation Enterprise Evolution
