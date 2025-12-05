// trigger/artifact-generation.ts
// Background job for generating complex artifacts
// Uses HTTP calls to Next.js API (no direct library imports)

import { task, logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const ArtifactGenerationPayload = z.object({
    jobId: z.string().uuid(),
    userId: z.string(),
    mode: z.enum(["Sales", "Marketing", "Admin"]),
    artifactType: z.enum(["document", "table", "chart", "report", "presentation"]),
    prompt: z.string(),
    context: z.object({
        ragEnabled: z.boolean().default(false),
        projectId: z.string().uuid().optional(),
        additionalContext: z.string().optional(),
    }).optional(),
    options: z.object({
        model: z.string().default("gpt-4o-mini"),
        maxTokens: z.number().default(4000),
        temperature: z.number().default(0.7),
    }).optional(),
});

export type ArtifactGenerationPayload = z.infer<typeof ArtifactGenerationPayload>;

function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
}

async function apiCall(endpoint: string, body: Record<string, any>): Promise<any> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-trigger-secret': process.env.TRIGGER_SECRET_KEY || '',
        },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API call failed: ${response.status} - ${error}`);
    }
    
    return response.json();
}

/**
 * Generate complex artifacts in the background
 * Supports documents, tables, charts, reports, and presentations
 */
export const generateArtifact = task({
    id: "generate-artifact",
    maxDuration: 600, // 10 minutes max
    retry: {
        maxAttempts: 2,
        minTimeoutInMs: 2000,
        maxTimeoutInMs: 30000,
        factor: 2,
    },
    run: async (payload: ArtifactGenerationPayload) => {
        const { jobId, userId, mode, artifactType, prompt, context, options } = payload;

        logger.info("Starting artifact generation", {
            jobId,
            artifactType,
            userId,
            baseUrl: getBaseUrl(),
        });

        try {
            // Call the artifact generation API endpoint
            const result = await apiCall('/api/artifacts/generate-background', {
                jobId,
                userId,
                mode,
                artifactType,
                prompt,
                context,
                options,
            });

            logger.info("Artifact generation completed", {
                jobId,
                artifactId: result.artifactId,
                totalTokens: result.usage?.totalTokens,
            });

            return {
                jobId,
                status: "success",
                artifactId: result.artifactId,
                artifact: result.artifact,
                usage: result.usage,
            };

        } catch (error: any) {
            logger.error("Artifact generation failed", { error: error.message });
            
            // Try to update job status
            try {
                await apiCall('/api/jobs/update-status', {
                    jobId,
                    status: 'failed',
                    error: error.message,
                });
            } catch (e) {
                // Non-critical
            }

            throw error;
        }
    },
});
