'use server'
import { Composio } from "composio-core";
import { auth } from "@clerk/nextjs/server";

// Initialize Composio
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

/**
 * Generates a magic link for the user to connect a specific SaaS tool.
 * @param toolName The name of the app to connect (e.g., "hubspot", "google_mail").
 * @returns The redirection URL.
 */
export async function getConnectLink(toolName: string): Promise<string> {
    // CRITICAL: Securely get the logged-in user ID from Clerk on the server
    const { userId } = await auth();

    if (!userId) {
        throw new Error("Authentication required to initiate connection.");
    }

    const entityId = userId;
    const redirectBase = process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000';

    try {
        const entity = await composio.getEntity(entityId);

        const connection = await entity.initiateConnection({
            appName: toolName,
            redirectUri: `${redirectBase}/workstation?toolConnected=${toolName}` // Success redirect
        });

        return connection.redirectUrl;

    } catch (error) {
        console.error(`Error initiating Composio connection for ${toolName}:`, error);
        throw new Error(`Failed to connect ${toolName}.`);
    }
}

/**
 * Fetches the list of connected apps for the current user.
 * @returns A list of app names (e.g., ['hubspot', 'google_mail'])
 */
export async function getConnectionStatus(): Promise<string[]> {
    const { userId } = await auth();
    if (!userId) return [];

    const entityId = userId;

    try {
        const entity = await composio.getEntity(entityId);
        const connections = await entity.getConnections();

        // Extract unique app names from connections
        const connectedApps = Array.from(new Set(connections.map(c => c.appName)));
        return connectedApps;
    } catch (error) {
        console.error("Error fetching connection status:", error);
        return [];
    }
}