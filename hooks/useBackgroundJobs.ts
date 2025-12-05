// hooks/useBackgroundJobs.ts
// React hook for managing background jobs

import { useState, useEffect, useCallback } from 'react';

export interface BackgroundJob {
    executionId: string;
    workflowName: string;
    status: 'running' | 'success' | 'failed' | 'partial' | 'cancelled';
    progress: {
        total: number;
        completed: number;
        failed?: number;
        percentage: number;
    };
    startedAt: string;
    endedAt?: string;
    error?: string;
}

export interface JobProgress {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
}

export function useBackgroundJobs(pollInterval: number = 3000) {
    const [jobs, setJobs] = useState<BackgroundJob[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch running jobs
    const fetchJobs = useCallback(async () => {
        try {
            const response = await fetch('/api/jobs');
            if (!response.ok) throw new Error('Failed to fetch jobs');
            
            const data = await response.json();
            setJobs(data.runningJobs || []);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, []);

    // Poll for updates when there are running jobs
    useEffect(() => {
        fetchJobs();

        const hasRunningJobs = jobs.some(j => j.status === 'running');
        
        if (hasRunningJobs) {
            const interval = setInterval(fetchJobs, pollInterval);
            return () => clearInterval(interval);
        }
    }, [fetchJobs, jobs.length, pollInterval]);

    // Trigger a new workflow job
    const triggerWorkflowJob = useCallback(async (payload: {
        workflowName: string;
        workflowDescription: string;
        steps: Array<{ name: string; description: string; tool?: string; parameters?: Record<string, any> }>;
        mode: 'Sales' | 'Marketing' | 'Admin';
        modelId: string;
    }) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobType: 'workflow',
                    payload,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to trigger job');
            }

            const data = await response.json();
            
            // Refresh job list
            await fetchJobs();
            
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [fetchJobs]);

    // Trigger bulk document processing
    const triggerBulkDocumentJob = useCallback(async (payload: {
        documents: Array<{ id: string; filename: string; fileType: string; fileSize: number }>;
        projectId?: string;
        tags?: string[];
        mode: 'Sales' | 'Marketing' | 'Admin';
    }) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobType: 'bulk-documents',
                    payload,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to trigger job');
            }

            const data = await response.json();
            await fetchJobs();
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [fetchJobs]);

    // Get job progress
    const getJobProgress = useCallback(async (executionId: string): Promise<{
        execution: any;
        steps: any[];
        progress: JobProgress;
    } | null> => {
        try {
            const response = await fetch(`/api/jobs?type=workflow&jobId=${executionId}`);
            if (!response.ok) return null;
            
            const data = await response.json();
            return data;
        } catch {
            return null;
        }
    }, []);

    // Cancel a job (future implementation)
    const cancelJob = useCallback(async (executionId: string) => {
        // TODO: Implement job cancellation
        console.log(`Cancel job: ${executionId}`);
    }, []);

    return {
        jobs,
        isLoading,
        error,
        triggerWorkflowJob,
        triggerBulkDocumentJob,
        getJobProgress,
        cancelJob,
        refreshJobs: fetchJobs,
        hasRunningJobs: jobs.some(j => j.status === 'running'),
    };
}

export default useBackgroundJobs;
