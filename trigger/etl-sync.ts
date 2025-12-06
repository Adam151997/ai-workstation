// trigger/etl-sync.ts
// Background job for ETL data synchronization
// Uses actual connectors for bulk data ingestion

import { task, wait } from "@trigger.dev/sdk/v3";

/**
 * ETL Sync Job Payload
 */
interface ETLSyncPayload {
    syncJobId: string;
    dataSourceId: string;
    sourceType: 'google_drive' | 'gmail' | 'notion' | 'slack' | 'dropbox' | 'onedrive';
    jobType: 'full_sync' | 'incremental' | 'delta' | 'manual';
    config: Record<string, any>;
    metadata: {
        userId: string;
        sourceName: string;
    };
}

/**
 * Main ETL Sync Job
 * 
 * Syncs data from external sources using actual connectors:
 * - Discovers items in source via Composio MCP
 * - Detects changes (delta sync)
 * - Downloads new/modified items
 * - Creates documents and indexes them
 */
export const etlSyncJob = task({
    id: "etl-sync",
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 5000,
        maxTimeoutInMs: 60000,
        factor: 2,
    },
    machine: {
        preset: "medium-1x",
    },
    run: async (payload: ETLSyncPayload, { ctx }) => {
        const { syncJobId, dataSourceId, sourceType, jobType, config, metadata } = payload;
        
        console.log(`[ETL Sync] 🚀 Starting ${jobType} sync for ${metadata.sourceName}`);
        console.log(`[ETL Sync] Source: ${sourceType}, Job: ${syncJobId}`);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        
        try {
            // 1. Update job status to running
            await updateSyncJob(baseUrl, syncJobId, {
                status: 'running',
                startedAt: new Date().toISOString(),
            });

            // 2. Call the actual sync API which uses real connectors
            const syncResponse = await fetch(`${baseUrl}/api/data-sources/sync/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-internal-trigger': 'true',
                },
                body: JSON.stringify({
                    syncJobId,
                    dataSourceId,
                    userId: metadata.userId,
                    jobType,
                }),
            });

            if (!syncResponse.ok) {
                throw new Error(`Sync API error: ${syncResponse.status}`);
            }

            const result = await syncResponse.json();

            // 3. Update job with results
            await updateSyncJob(baseUrl, syncJobId, {
                status: result.itemsFailed > 0 ? 'completed' : 'completed',
                completedAt: new Date().toISOString(),
                itemsFound: result.itemsFound,
                itemsProcessed: result.itemsProcessed,
                itemsCreated: result.itemsCreated,
                itemsUpdated: result.itemsUpdated,
                itemsSkipped: result.itemsSkipped,
                itemsFailed: result.itemsFailed,
            });

            // 4. Update data source
            await updateDataSource(baseUrl, dataSourceId, {
                connectionStatus: 'connected',
                lastSyncAt: new Date().toISOString(),
                lastSyncStatus: result.itemsFailed === 0 ? 'success' : 'partial',
                totalItemsSynced: result.itemsProcessed,
            });

            console.log(`[ETL Sync] 🏁 Completed: ${result.itemsProcessed} processed, ${result.itemsCreated} created, ${result.itemsFailed} failed`);

            return {
                syncJobId,
                status: 'completed',
                ...result,
            };

        } catch (error: any) {
            console.error(`[ETL Sync] ❌ Job failed: ${error.message}`);

            await updateSyncJob(baseUrl, syncJobId, {
                status: 'failed',
                completedAt: new Date().toISOString(),
                errorMessage: error.message,
            });

            await updateDataSource(baseUrl, dataSourceId, {
                connectionStatus: 'error',
                lastSyncStatus: 'failed',
                lastSyncError: error.message,
            });

            throw error;
        }
    },
});

/**
 * Update sync job in database
 */
async function updateSyncJob(
    baseUrl: string,
    syncJobId: string,
    data: Record<string, any>
): Promise<void> {
    try {
        await fetch(`${baseUrl}/api/data-sources/sync/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-trigger': 'true',
            },
            body: JSON.stringify({
                syncJobId,
                ...data,
            }),
        });
    } catch (e) {
        console.error('[ETL Sync] Failed to update sync job:', e);
    }
}

/**
 * Update data source in database
 */
async function updateDataSource(
    baseUrl: string,
    dataSourceId: string,
    data: Record<string, any>
): Promise<void> {
    try {
        await fetch(`${baseUrl}/api/data-sources/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-trigger': 'true',
            },
            body: JSON.stringify({
                dataSourceId,
                ...data,
            }),
        });
    } catch (e) {
        console.error('[ETL Sync] Failed to update data source:', e);
    }
}

/**
 * Scheduled sync job - runs periodically
 */
export const scheduledSyncJob = task({
    id: "scheduled-etl-sync",
    retry: { maxAttempts: 2 },
    run: async (payload: { userId: string }) => {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        try {
            // Get all active data sources with scheduled syncs due
            const response = await fetch(`${baseUrl}/api/data-sources/scheduled?userId=${payload.userId}`, {
                headers: { 'x-internal-trigger': 'true' },
            });

            if (!response.ok) return { syncsTriggered: 0 };

            const data = await response.json();
            const dueSyncs = data.scheduledSyncs || [];

            console.log(`[Scheduled Sync] Found ${dueSyncs.length} scheduled syncs due`);

            // Trigger each sync
            for (const sync of dueSyncs) {
                await fetch(`${baseUrl}/api/data-sources/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-internal-trigger': 'true',
                    },
                    body: JSON.stringify({
                        dataSourceId: sync.dataSourceId,
                        jobType: 'incremental',
                    }),
                });

                // Small delay between triggers
                await wait.for({ seconds: 2 });
            }

            return { syncsTriggered: dueSyncs.length };

        } catch (error: any) {
            console.error('[Scheduled Sync] Error:', error.message);
            return { syncsTriggered: 0, error: error.message };
        }
    },
});
