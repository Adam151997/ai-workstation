// config/ai-models.ts
// Unified AI model configuration supporting multiple providers

export type AIProvider = 'groq' | 'openai';

export interface AIModel {
    id: string;
    name: string;
    provider: AIProvider;
    description: string;
    contextWindow: number;
    costPer1MTokens: number; // in USD (input cost)
    recommended: boolean;
    supportsTools: boolean;
    maxTokensPerDay?: number; // Free tier limits
}

export const AI_MODELS: AIModel[] = [
    // OpenAI Models - PRIMARY (Excellent tool support!)
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        description: 'Fast, affordable, great balance',
        contextWindow: 128000,
        costPer1MTokens: 0.15,
        recommended: true,
        supportsTools: true,  // ✅ Works perfectly with Composio MCP
    },
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        description: 'Best reasoning and quality',
        contextWindow: 128000,
        costPer1MTokens: 2.50,
        recommended: false,
        supportsTools: true,  // ✅ Works perfectly with Composio MCP
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        description: 'Fast, affordable classic',
        contextWindow: 16385,
        costPer1MTokens: 0.50,
        recommended: false,
        supportsTools: true,  // ✅ Works with Composio MCP
    },
    
    // Groq Models - BACKUP (Limited structured output support)
    {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        description: 'Fast (Groq backup)',
        contextWindow: 128000,
        costPer1MTokens: 0.05,
        recommended: false,
        supportsTools: true,
        maxTokensPerDay: 100000,
    },
    {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        provider: 'groq',
        description: 'Powerful (Groq backup)',
        contextWindow: 128000,
        costPer1MTokens: 0.59,
        recommended: false,
        supportsTools: true,
        maxTokensPerDay: 100000,
    },
];

export const DEFAULT_MODEL = 'gpt-4o-mini';

export const PROVIDER_INFO = {
    groq: {
        name: 'Groq',
        description: 'Ultra-fast inference with LPU technology',
        website: 'https://groq.com',
    },
    openai: {
        name: 'OpenAI',
        description: 'Industry-leading AI models with excellent tool support',
        website: 'https://openai.com',
    },
};

// Group models by provider
export const getModelsByProvider = () => {
    return AI_MODELS.reduce((acc, model) => {
        if (!acc[model.provider]) {
            acc[model.provider] = [];
        }
        acc[model.provider].push(model);
        return acc;
    }, {} as Record<AIProvider, AIModel[]>);
};

// Get model info by ID
export const getModelInfo = (modelId: string): AIModel | undefined => {
    return AI_MODELS.find(m => m.id === modelId);
};
