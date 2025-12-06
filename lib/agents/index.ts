// lib/agents/index.ts
// Agent System Exports

// Types
export * from './types';

// Base Agent
export { 
    BaseAgent, 
    callLLM, 
    registerAgent, 
    createAgent, 
    getRegisteredAgents,
    type LLMConfig,
} from './base';

// Configurations
export { 
    AGENT_CONFIGS, 
    getAgentConfig, 
    getAllAgentRoles, 
    getSpecialistRoles,
    getAgentByKeywords,
} from './configs';

// Router Agent
export {
    RouterAgent,
    getRouter,
    routeQuery,
    quickRoute,
} from './router';

// Specialist Agents
export {
    GeneralAgent,
    SalesAgent,
    MarketingAgent,
    ResearchAgent,
    CodeAgent,
    DataAgent,
    createSpecialistAgent,
    SPECIALIST_AGENTS,
} from './specialists';
