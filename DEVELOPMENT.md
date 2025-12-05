## UI Theme System

### Design System
**Font:** Proto Mono (display), Inter (body), JetBrains Mono (code)
**Accent:** Electric Purple (#8b5cf6)
**Style:** Hybrid density (dense data areas, clean navigation)

### Theme Variables
```css
/* Usage */
color: var(--text-primary);
background: var(--surface-primary);
border: 1px solid var(--border-primary);
box-shadow: var(--shadow-glow);
```

### Key CSS Classes
| Class | Purpose |
|-------|--------|
| `.glass-card` | Glassmorphism card with blur |
| `.btn-accent` | Primary gradient button with glow |
| `.btn-ghost` | Transparent outlined button |
| `.input-field` | Styled input with focus glow |
| `.nav-item` | Sidebar navigation item |
| `.badge` | Status badge with variants |
| `.data-value` | Large numeric display |
| `.data-label` | Uppercase label |
| `.glow` | Box shadow glow effect |
| `.shimmer` | Loading animation |

### Theme Toggle
```tsx
import { useTheme } from '@/components/ThemeProvider';
const { theme, toggleTheme } = useTheme();
```

### Special Effects
- Subtle glow on interactive elements
- Glassmorphism cards
- Gradient borders on hover
- Pulse animations for status indicators

---

# AI Workstation OS - Development Progress

## Project Overview
Enterprise AI platform with multi-mode workstation (Sales/Marketing/Admin), RAG document management, Composio MCP tool integration, and comprehensive audit trails.

---

## Phase 1: Audit Log Integration ✅ Complete

### Audit Utility (`lib/audit.ts`)
- Typed actions covering all operations
- Helper functions: `logDocumentAction`, `logChatAction`, `logProjectAction`, `logTagAction`, `logSettingsAction`, `logSearchAction`
- Non-blocking audit creation (doesn't break main flow)
- IP address and user agent extraction

### APIs with Audit Logging
| API Endpoint | Actions Logged |
|--------------|----------------|
| `/api/documents/upload` | `document.upload` with filename, size, chunks, project, tags |
| `/api/documents/[id]` | `document.update` with changes and reindex status |
| `/api/documents` | `document.delete` with metadata |
| `/api/documents/download` | `document.download` with filename, type, size |
| `/api/documents/search` | `search.query` with query, type, mode, results |
| `/api/projects` | `project.create/update/delete/archive` with changes |
| `/api/tags` | `tag.create/update/delete` with usage counts |
| `/api/tools/user` | `settings.tools_update` with added/removed tools |
| `/api/chat` | `chat.message` with mode, model, tool count |

### Database Schema Update (Migration 007)
- Added `action`, `resource`, `resource_id`, `ip_address`, `user_agent` to `audit_logs`
- Added `updated_at` to `documents` table
- Created indexes for query performance
- Run via: `/api/setup/audit-update`

---

## Phase 2: Document Management ✅ Complete

### 2.1 Document Re-indexing ✅
**API:** `/api/documents/[id]`
- `GET`: Fetch single document with project/tags
- `PATCH`: Update project/tags + re-index in Pinecone
- Metadata sync between DB and vector store

**UI Enhancement:**
- Edit button per document
- Inline edit mode with ProjectSelector and TagSelector
- "Save & Re-index" button
- Visual feedback during save

### 2.2 Bulk Document Operations ✅
**API:** `/api/documents/bulk`
- `delete`: Bulk delete from Pinecone + database
- `setProject`: Assign project + re-index
- `setTags`: Replace tags + re-index
- `addTags`: Add tags + re-index
- `removeTags`: Remove tags + re-index

**UI Enhancement:**
- Multi-select with checkboxes
- "Select All" / "Deselect All" buttons
- Bulk actions dropdown menu
- Confirmation dialogs for safety
- Progress indicators

### 2.3 Search Within Documents ✅
**API:** `/api/documents/search`
- **Semantic Search**: Pinecone vector similarity with embeddings
- **Text Search**: PostgreSQL ILIKE pattern matching
- Filters: mode, projectId
- Returns: documents with relevance scores and matching chunks

**UI Enhancement:**
- Search bar with debounced queries
- Toggle between semantic and text search
- Search results with highlighted matching chunks
- Clear search button
- Search tips info box

### 2.4 Document Export/Download ✅
**API:** `/api/documents/download`
- Retrieves original file from database
- Proper content-type headers
- Download as attachment
- Audit logged

**UI Enhancement:**
- Download button per document (green icon)
- Direct download link

---

## Phase 3: Observability & Analytics 🚧 In Progress

### 3.1 Observability Dashboard ✅ Complete
**Page:** `/settings/observability`

**Features:**
- Overview stats cards (workflows, cost, tokens, success rate)
- Document statistics (total docs, chunks, recent uploads)
- Usage breakdown by mode (Sales/Marketing/Admin)
- Documents by mode visualization with progress bars
- Recent activity feed with action icons
- Auto-refresh every 30 seconds
- Manual refresh button

**API:** `/api/observability/documents`
- Total documents count
- Total chunks (vectors indexed)
- Documents by mode breakdown
- Documents by file type
- Recent uploads (last 7 days)
- Documents by project
- Total storage size

**Metrics Displayed:**
| Metric | Source |
|--------|--------|
| Total Workflows | `workflow_executions` table |
| Success/Failed | Status counts from executions |
| Total Cost | Sum of `total_cost` |
| Total Tokens | Sum of `total_tokens` |
| Success Rate | Calculated percentage |
| Average Execution Time | Computed from timestamps |
| Total Documents | `documents` table |
| Total Chunks | `document_chunks` table |
| Audit Logs | `audit_logs` table |
| Running Workflows | Status = 'running' |

### 3.2 Billing System ✅ Complete
**Page:** `/settings/billing`

**Features:**
- Current plan display with tier details
- Usage overview (tokens, requests, cost)
- Rate limit status and details
- Usage history (14-day chart)
- Available plans comparison
- Upgrade/downgrade options

**Database Schema (Migration 008):**
- `subscription_tiers`: Plans with pricing and limits
- `user_subscriptions`: User subscription status
- `usage_records`: Granular usage tracking
- `usage_aggregates`: Daily aggregated usage
- `billing_periods`: Monthly billing periods
- `rate_limit_windows`: Rate limit tracking
- `payment_history`: Payment transactions

**Subscription Tiers:**
| Tier | Tokens/Month | Requests/Day | Documents | Price |
|------|--------------|--------------|-----------|-------|
| Free | 50,000 | 50 | 10 | $0 |
| Pro | 500,000 | 500 | 100 | $29.99/mo |
| Team | 2,000,000 | 2,000 | 500 | $79.99/mo |
| Enterprise | Custom | Custom | Custom | Contact |

**Rate Limiting:**
- Per-minute request limits
- Daily request limits
- Monthly token limits
- Automatic blocking when exceeded
- Reset notifications

**Usage Tracking:**
- Chat API tracks estimated tokens (input/output)
- Cost calculation per model
- Duration tracking
- Aggregated daily summaries
- Triggered automatic updates

**Setup:** Run `/api/setup/billing` to create tables

### 3.3 Workflow Builder ✅ Complete
**Page:** `/workstation/workflows`

**Features:**
- Visual workflow list with card-based UI
- Create new workflows with step-by-step builder
- Edit existing workflows
- Run workflows with input parameters
- Duplicate system templates
- Delete custom workflows
- Category filtering (Research, Content, Data, Custom)
- Search workflows by name/description
- Run statistics (count, success rate, duration)

**Database Schema (Migration 009):**
- `workflow_templates`: Workflow definitions with steps as JSONB
- `workflow_runs`: Individual execution records
- `workflow_schedules`: Scheduled workflow configuration

**Step Types:**
| Type | Description | Config |
|------|-------------|--------|
| `ai_prompt` | Generate text with AI | prompt, model, maxTokens |
| `tool_call` | Execute MCP tool | tool, params |
| `condition` | Branch logic | condition expression |
| `delay` | Wait duration | delay in ms |
| `webhook` | External API call | url, method, headers |

**System Templates (Pre-built):**
- Research Assistant: Web search + summarize
- Blog Post Generator: Outline + draft + polish
- Document Analyzer: RAG search + extract + summarize

**Variable System:**
- Input variables: `{{variable_name}}`
- Step outputs: `{{step_N_output}}`
- Dynamic parameter replacement

**APIs:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List templates |
| POST | `/api/workflows` | Create template |
| GET | `/api/workflows/[id]` | Get template |
| PUT | `/api/workflows/[id]` | Update template |
| DELETE | `/api/workflows/[id]` | Delete template |
| POST | `/api/workflows/[id]/run` | Execute workflow |

**Setup:** Run `/api/setup/workflows` to create tables

### 3.4 Enhanced Charts ✅ Complete
**Components:** `components/charts/UsageCharts.tsx`

**Chart Types:**
| Chart | Description | Use Case |
|-------|-------------|----------|
| `TokenUsageChart` | Area chart with gradient | Token consumption over time |
| `RequestChart` | Bar chart | Daily request counts |
| `CostTrendChart` | Line chart with dots | Cost trends |
| `SuccessRateChart` | Area chart | Workflow success percentage |
| `CombinedUsageChart` | Composed (area + bar) | Tokens + requests together |
| `CostBreakdownChart` | Stacked area | Cost by type (chat/embedding) |
| `SparklineChart` | Mini line chart | Inline dashboard indicators |

**API Endpoint:** `/api/analytics`
| Parameter | Values | Description |
|-----------|--------|-------------|
| `type` | usage, cost, workflows, summary | Data type |
| `days` | 7, 14, 30 | Time period |

**Features:**
- Dynamic imports to avoid SSR issues
- Custom tooltips with formatted values
- Gradient fills for visual appeal
- Responsive containers
- Period selector (7/14/30 days)
- Chart type switcher (combined/tokens/cost)
- Summary stats above charts
- Auto-fill missing dates with zeros

**Integrated Into:**
- Observability Dashboard (`/settings/observability`)
- Billing Page (`/settings/billing`)

**Install:** `npm install recharts`

### 3.5 Trigger.dev Production (Planned)

---

## API Endpoints Summary

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List documents (with filters) |
| POST | `/api/documents` | Upload document |
| DELETE | `/api/documents` | Delete document |
| GET | `/api/documents/[id]` | Get single document |
| PATCH | `/api/documents/[id]` | Update + re-index |
| POST | `/api/documents/bulk` | Bulk operations |
| GET | `/api/documents/search` | Search documents |
| GET | `/api/documents/download` | Download original file |
| POST | `/api/documents/upload` | Upload with chunking |

### Projects & Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/projects` | CRUD operations |
| GET/POST/PUT/DELETE | `/api/tags` | CRUD operations |

### Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/tools` | List/add MCP tools |
| GET/POST | `/api/tools/user` | Per-user tool config |

### Observability
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflow?type=stats` | Workflow statistics |
| GET | `/api/workflow?type=cost-by-mode` | Cost breakdown by mode |
| GET | `/api/workflow?type=metrics` | Time-series metrics |
| GET | `/api/observability/documents` | Document statistics |
| GET | `/api/audit` | Audit log entries |

### Settings & Setup
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activity` | Audit log activity |
| GET | `/api/jobs` | Background jobs |
| GET | `/api/setup/audit-update` | Run audit schema migration |
| GET | `/api/setup/billing` | Run billing system migration |

### Billing & Usage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/subscription` | User's current subscription |
| POST | `/api/billing/subscription` | Create/update subscription |
| GET | `/api/billing/tiers` | Available subscription tiers |
| GET | `/api/billing/usage?type=summary` | Usage summary with rate limits |
| GET | `/api/billing/usage?type=history` | Usage history by day |
| GET | `/api/billing/usage?type=rate-limits` | Current rate limit status |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List workflow templates |
| POST | `/api/workflows` | Create workflow template |
| GET | `/api/workflows/[id]` | Get workflow details |
| PUT | `/api/workflows/[id]` | Update workflow |
| DELETE | `/api/workflows/[id]` | Delete workflow |
| POST | `/api/workflows/[id]/run` | Execute workflow |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics?type=usage` | Time-series usage data |
| GET | `/api/analytics?type=cost` | Cost breakdown over time |
| GET | `/api/analytics?type=workflows` | Workflow stats over time |
| GET | `/api/analytics?type=summary` | Overall summary with trends |

---

## Settings Navigation
| Page | Path | Description |
|------|------|-------------|
| Observability | `/settings/observability` | Usage metrics & analytics |
| Billing | `/settings/billing` | Subscription & usage |
| Tools | `/settings/tools` | Manage AI toolkit |
| Projects | `/settings/projects` | Organize documents |
| Tags | `/settings/tags` | Create and manage tags |
| Data Sources | `/settings/data-sources` | Connect external data |
| Background Jobs | `/settings/jobs` | View running tasks |
| Activity | `/settings/activity` | View audit logs |

---

## Tech Stack
- **Frontend**: Next.js 16.0.5, React, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes, PostgreSQL
- **AI**: OpenAI API, AI SDK v5.0.104 (manual streaming)
- **Vector Store**: Pinecone
- **Background Jobs**: Trigger.dev v4
- **Auth**: Clerk
- **MCP Tools**: Composio (127+ tools)

---

## Database Tables
| Table | Purpose |
|-------|---------|
| `documents` | Uploaded files with metadata |
| `document_chunks` | Text chunks for RAG |
| `document_tags` | Document-tag relationships |
| `projects` | Document organization |
| `tags` | Document labels |
| `workflow_executions` | Workflow run history |
| `workflow_steps` | Individual workflow steps |
| `workflow_templates` | Saved workflow definitions |
| `workflow_runs` | Template execution records |
| `workflow_schedules` | Scheduled workflow config |
| `audit_logs` | All tracked activities |
| `observability_metrics` | Aggregated metrics |
| `subscription_tiers` | Available plans with pricing |
| `user_subscriptions` | User subscription status |
| `usage_records` | Granular usage tracking |
| `usage_aggregates` | Daily aggregated usage |
| `billing_periods` | Monthly billing periods |
| `rate_limit_windows` | Rate limit tracking |
| `payment_history` | Payment transactions |
| `user_tools` | Per-user tool configuration |
| `tool_catalog` | Available MCP tools |
| `tool_categories` | Tool categorization |

---

## Running Locally

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma db push

# Run schema updates
curl http://localhost:3000/api/setup/audit-update
curl http://localhost:3000/api/setup/billing
curl http://localhost:3000/api/setup/workflows

# Start development server
npm run dev

# Start Trigger.dev worker (optional)
npx trigger.dev@latest dev
```

---

Last Updated: December 5, 2025
