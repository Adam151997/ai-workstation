# Phase 1: Async Job Queue - Trigger.dev Integration

## Installation

Run the following commands to set up Trigger.dev:

```bash
# Install Trigger.dev SDK
npm install @trigger.dev/sdk @trigger.dev/nextjs

# Initialize Trigger.dev (creates trigger folder structure)
npx trigger.dev@latest init
```

## Environment Variables

Add these to your `.env.local`:

```env
# Trigger.dev Configuration
TRIGGER_SECRET_KEY=tr_dev_xxxxx  # Get from trigger.dev dashboard
TRIGGER_PUBLIC_API_KEY=pk_xxxxx  # Get from trigger.dev dashboard
```

## Setup Steps

1. **Create Trigger.dev Account**
   - Go to https://trigger.dev
   - Create a new project
   - Copy your API keys

2. **Run the init command**
   ```bash
   npx trigger.dev@latest init
   ```

3. **Start the Trigger.dev dev server**
   ```bash
   npx trigger.dev@latest dev
   ```

4. **Your Next.js app communicates with Trigger.dev**
   - Jobs are defined in `/trigger` folder
   - Jobs run in Trigger.dev's infrastructure
   - No Vercel timeout limits!

## Project Structure After Setup

```
ai-workstation/
├── trigger/
│   ├── workflow-execution.ts    # Workflow job definitions
│   ├── bulk-document.ts         # Bulk document processing
│   └── index.ts                 # Job exports
├── app/
│   └── api/
│       └── trigger/
│           └── route.ts         # Trigger.dev webhook handler
```
