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

// Agent Crew (Orchestrator)
export {
    AgentCrew,
    CREW_CONFIGS,
    createCrew,
    createCustomCrew,
    getDefaultCrew,
    processWithCrew,
} from './crew';

// Memory System
export {
    MemoryManager,
    getMemoryManager,
    storeMemory,
    getRelevantMemories,
    buildMemoryContext,
    learnFromConversation,
    type StoredMemory,
    type MemorySearchOptions,
} from './memory';

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

// Critic Agent (existing - functional)
export { reviewOutput, type CriticReview } from './critic';
