// lib/agents/specialists/index.ts
// Specialist Agent Exports and Registration

import { registerAgent } from '../base';
import { AGENT_CONFIGS } from '../configs';

// Import all specialist agents
import { GeneralAgent } from './general';
import { SalesAgent } from './sales';
import { MarketingAgent } from './marketing';
import { ResearchAgent } from './research';
import { CodeAgent } from './code';
import { DataAgent } from './data';

// Export agent classes
export {
    GeneralAgent,
    SalesAgent,
    MarketingAgent,
    ResearchAgent,
    CodeAgent,
    DataAgent,
};

// Register all agents with the factory
export function registerAllAgents(): void {
    registerAgent('general', GeneralAgent as any);
    registerAgent('sales', SalesAgent as any);
    registerAgent('marketing', MarketingAgent as any);
    registerAgent('research', ResearchAgent as any);
    registerAgent('code', CodeAgent as any);
    registerAgent('data', DataAgent as any);
    
    console.log('[Agents] Registered 6 specialist agents');
}

// Auto-register on import
registerAllAgents();

// Helper to create agent instances with default configs
export function createSpecialistAgent(role: 'general' | 'sales' | 'marketing' | 'research' | 'code' | 'data') {
    const config = AGENT_CONFIGS[role];
    
    switch (role) {
        case 'general':
            return new GeneralAgent(config);
        case 'sales':
            return new SalesAgent(config);
        case 'marketing':
            return new MarketingAgent(config);
        case 'research':
            return new ResearchAgent(config);
        case 'code':
            return new CodeAgent(config);
        case 'data':
            return new DataAgent(config);
        default:
            return new GeneralAgent(AGENT_CONFIGS.general);
    }
}

// Agent metadata for UI
export const SPECIALIST_AGENTS = [
    {
        ...AGENT_CONFIGS.sales.identity,
        keywords: ['CRM', 'deals', 'pipeline', 'leads', 'contacts'],
    },
    {
        ...AGENT_CONFIGS.marketing.identity,
        keywords: ['campaigns', 'content', 'social', 'email', 'ads'],
    },
    {
        ...AGENT_CONFIGS.research.identity,
        keywords: ['search', 'analyze', 'investigate', 'compare'],
    },
    {
        ...AGENT_CONFIGS.code.identity,
        keywords: ['code', 'debug', 'develop', 'API', 'script'],
    },
    {
        ...AGENT_CONFIGS.data.identity,
        keywords: ['analytics', 'charts', 'spreadsheet', 'metrics'],
    },
    {
        ...AGENT_CONFIGS.general.identity,
        keywords: ['help', 'explain', 'general'],
    },
];
