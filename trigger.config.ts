// trigger.config.ts
// Trigger.dev v4 configuration for AI Workstation

import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
    project: "proj_ryohghdirldysgizzisx",
    runtime: "node",
    logLevel: "info", // Changed from debug to reduce noise
    maxDuration: 300,
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
    dirs: ["./trigger"],
    
    // Build configuration
    build: {
        // Mark these packages as external (not bundled)
        external: [
            // PDF/Document processing (browser APIs)
            "pdfjs-dist",
            "pdf-parse", 
            "canvas",
            "mammoth",
            "xlsx",
            "jsdom",
            // Vector databases
            "@pinecone-database/pinecone",
            // AI SDKs
            "ai",
            "@ai-sdk/openai",
            "@ai-sdk/anthropic", 
            "@ai-sdk/groq",
            // Database
            "@prisma/client",
            "pg",
            "@neondatabase/serverless",
            // Composio
            "composio-core",
            // Other heavy packages
            "sharp",
            "puppeteer",
            "playwright",
        ],
        // Build conditions for Node.js environment
        conditions: ["node", "import"],
    },
});
