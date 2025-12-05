// config/groq-models.ts
export const GROQ_MODELS = [
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: '128K context, faster responses',
        recommended: true,
    },
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        description: '128K context window',
        recommended: false,
    },
    {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        description: '128K context window',
        recommended: false,
    },
    {
        id: 'llama-3.2-1b-preview',
        name: 'Llama 3.2 1B (Preview)',
        description: '128K context, very fast',
        recommended: false,
    },
    {
        id: 'llama-3.2-3b-preview',
        name: 'Llama 3.2 3B (Preview)',
        description: '128K context, fast',
        recommended: false,
    },
] as const;

export const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export type GroqModel = typeof GROQ_MODELS[number]['id'];
