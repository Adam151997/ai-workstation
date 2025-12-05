'use server';

import { LeadsSchema, LeadsArtifact } from '@/config/schemas/leads';
import { streamObject } from 'ai';
import { createStreamableValue } from '@ai-sdk/rsc';
import { groq } from '@ai-sdk/groq';
import { auth } from "@clerk/nextjs/server";

/**
 * Generates a structured data artifact (Leads table) and streams it.
 */
export async function generateLeadsArtifact(prompt: string) {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const stream = createStreamableValue();

    (async () => {
        const { partialObjectStream } = await streamObject({
            model: groq('mixtral-8x7b-32768'),
            schema: LeadsSchema,
            prompt: `Analyze the user's request: "${prompt}". Generate a list of 5 leads relevant to this request, using a JSON format defined by the schema.`,
        });

        for await (const partial of partialObjectStream) {
            stream.update(partial);
        }

        stream.done();
    })();

    return { object: stream.value };
}