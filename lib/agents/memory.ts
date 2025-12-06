// lib/agents/memory.ts
// Cross-Context Memory - Shared knowledge across conversations

import { query } from '@/lib/db';
import { AgentRole, MemoryItem, AgentMemory } from './types';

// =============================================================================
// Memory Types
// =============================================================================

export interface StoredMemory {
    id: string;
    userId: string;
    type: MemoryItem['type'];
    content: string;
    source: AgentRole;
    relevance: number;
    metadata: Record<string, any>;
    embedding?: number[];
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}

export interface MemorySearchOptions {
    types?: MemoryItem['type'][];
    sources?: AgentRole[];
    minRelevance?: number;
    limit?: number;
    query?: string;
}

// =============================================================================
// Memory Manager Class
// =============================================================================

export class MemoryManager {
    private userId: string;
    private cache: Map<string, MemoryItem[]> = new Map();
    private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

    constructor(userId: string) {
        this.userId = userId;
    }

    // =========================================================================
    // Core Memory Operations
    // =========================================================================

    /**
     * Store a new memory
     */
    async store(memory: Omit<MemoryItem, 'id' | 'timestamp'>): Promise<MemoryItem> {
        const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date();

        const item: MemoryItem = {
            id,
            timestamp,
            ...memory,
        };

        try {
            await query(`
                INSERT INTO agent_memories (
                    id, user_id, type, content, source, relevance, metadata, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                id,
                this.userId,
                memory.type,
                memory.content,
                memory.source,
                memory.relevance || 0.5,
                JSON.stringify(memory.metadata || {}),
                timestamp,
            ]);

            // Invalidate cache
            this.cache.clear();

            return item;
        } catch (error) {
            console.error('[Memory] Failed to store memory:', error);
            throw error;
        }
    }

    /**
     * Retrieve memories based on search options
     */
    async retrieve(options: MemorySearchOptions = {}): Promise<MemoryItem[]> {
        const cacheKey = JSON.stringify(options);
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            let sql = `
                SELECT id, type, content, source, relevance, metadata, created_at as timestamp
                FROM agent_memories
                WHERE user_id = $1
            `;
            const params: any[] = [this.userId];
            let paramIndex = 2;

            // Filter by types
            if (options.types && options.types.length > 0) {
                sql += ` AND type = ANY($${paramIndex})`;
                params.push(options.types);
                paramIndex++;
            }

            // Filter by sources
            if (options.sources && options.sources.length > 0) {
                sql += ` AND source = ANY($${paramIndex})`;
                params.push(options.sources);
                paramIndex++;
            }

            // Filter by relevance
            if (options.minRelevance !== undefined) {
                sql += ` AND relevance >= $${paramIndex}`;
                params.push(options.minRelevance);
                paramIndex++;
            }

            // Text search
            if (options.query) {
                sql += ` AND content ILIKE $${paramIndex}`;
                params.push(`%${options.query}%`);
                paramIndex++;
            }

            // Order and limit
            sql += ` ORDER BY relevance DESC, created_at DESC`;
            
            if (options.limit) {
                sql += ` LIMIT $${paramIndex}`;
                params.push(options.limit);
            }

            const rows = await query(sql, params);

            const memories: MemoryItem[] = rows.map((row: any) => ({
                id: row.id,
                type: row.type,
                content: row.content,
                source: row.source,
                relevance: parseFloat(row.relevance),
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                timestamp: new Date(row.timestamp),
            }));

            // Cache results
            this.cache.set(cacheKey, memories);
            setTimeout(() => this.cache.delete(cacheKey), this.cacheExpiry);

            return memories;
        } catch (error) {
            console.error('[Memory] Failed to retrieve memories:', error);
            return [];
        }
    }

    /**
     * Get memories relevant to a specific query
     */
    async getRelevant(queryText: string, limit: number = 10): Promise<MemoryItem[]> {
        // Extract keywords for search
        const keywords = this.extractKeywords(queryText);
        
        if (keywords.length === 0) {
            return this.retrieve({ limit });
        }

        // Search for each keyword and combine results
        const allMemories: MemoryItem[] = [];
        
        for (const keyword of keywords.slice(0, 3)) { // Limit to 3 keywords
            const memories = await this.retrieve({
                query: keyword,
                limit: Math.ceil(limit / keywords.length),
            });
            allMemories.push(...memories);
        }

        // Deduplicate and sort by relevance
        const uniqueMemories = this.deduplicateMemories(allMemories);
        return uniqueMemories.slice(0, limit);
    }

    /**
     * Update memory relevance based on usage
     */
    async updateRelevance(memoryId: string, delta: number): Promise<void> {
        try {
            await query(`
                UPDATE agent_memories
                SET relevance = LEAST(1, GREATEST(0, relevance + $1)),
                    updated_at = NOW()
                WHERE id = $2 AND user_id = $3
            `, [delta, memoryId, this.userId]);

            this.cache.clear();
        } catch (error) {
            console.error('[Memory] Failed to update relevance:', error);
        }
    }

    /**
     * Delete a specific memory
     */
    async delete(memoryId: string): Promise<void> {
        try {
            await query(`
                DELETE FROM agent_memories
                WHERE id = $1 AND user_id = $2
            `, [memoryId, this.userId]);

            this.cache.clear();
        } catch (error) {
            console.error('[Memory] Failed to delete memory:', error);
        }
    }

    /**
     * Clear all memories for this user
     */
    async clearAll(): Promise<void> {
        try {
            await query(`
                DELETE FROM agent_memories
                WHERE user_id = $1
            `, [this.userId]);

            this.cache.clear();
        } catch (error) {
            console.error('[Memory] Failed to clear memories:', error);
        }
    }

    // =========================================================================
    // Memory Building
    // =========================================================================

    /**
     * Build an AgentMemory object for use in agent context
     */
    async buildAgentMemory(queryText?: string): Promise<AgentMemory> {
        // Get recent memories (short-term)
        const shortTerm = await this.retrieve({
            limit: 10,
            minRelevance: 0.3,
        });

        // Get relevant memories if query provided
        let longTerm: MemoryItem[] = [];
        if (queryText) {
            longTerm = await this.getRelevant(queryText, 10);
        } else {
            // Get high-relevance memories
            longTerm = await this.retrieve({
                limit: 10,
                minRelevance: 0.7,
            });
        }

        return {
            shortTerm,
            longTerm,
            workingMemory: {},
        };
    }

    // =========================================================================
    // Memory Extraction
    // =========================================================================

    /**
     * Extract memories from a conversation
     */
    async extractFromConversation(
        messages: { role: string; content: string }[],
        agentRole: AgentRole
    ): Promise<MemoryItem[]> {
        const extracted: MemoryItem[] = [];

        for (const message of messages) {
            // Extract facts
            const facts = this.extractFacts(message.content);
            for (const fact of facts) {
                const item = await this.store({
                    type: 'fact',
                    content: fact,
                    source: agentRole,
                    relevance: 0.6,
                });
                extracted.push(item);
            }

            // Extract preferences
            const preferences = this.extractPreferences(message.content);
            for (const pref of preferences) {
                const item = await this.store({
                    type: 'preference',
                    content: pref,
                    source: agentRole,
                    relevance: 0.7,
                });
                extracted.push(item);
            }

            // Extract decisions
            const decisions = this.extractDecisions(message.content);
            for (const decision of decisions) {
                const item = await this.store({
                    type: 'decision',
                    content: decision,
                    source: agentRole,
                    relevance: 0.8,
                });
                extracted.push(item);
            }
        }

        return extracted;
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private extractKeywords(text: string): string[] {
        // Remove common words and extract meaningful keywords
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
            'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
            'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
            'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
            'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at',
            'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
            'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
            'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
            'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'my',
            'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us',
            'them', 'please', 'help', 'want', 'need', 'like', 'get', 'make',
        ]);

        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word))
            .slice(0, 10);
    }

    private deduplicateMemories(memories: MemoryItem[]): MemoryItem[] {
        const seen = new Set<string>();
        return memories.filter(memory => {
            if (seen.has(memory.id)) return false;
            seen.add(memory.id);
            return true;
        }).sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    }

    private extractFacts(text: string): string[] {
        const facts: string[] = [];
        
        // Look for patterns like "X is Y", "X has Y", "X works at Y"
        const patterns = [
            /(?:my|our|the)\s+(\w+)\s+is\s+([^.!?]+)/gi,
            /(?:I|we)\s+(?:work|live|am)\s+(?:at|in)\s+([^.!?]+)/gi,
            /(?:the|our)\s+(?:company|team|project)\s+([^.!?]+)/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[0].length < 100) { // Reasonable length
                    facts.push(match[0].trim());
                }
            }
        }

        return facts.slice(0, 5); // Limit extracted facts
    }

    private extractPreferences(text: string): string[] {
        const preferences: string[] = [];
        
        // Look for preference patterns
        const patterns = [
            /(?:I|we)\s+(?:prefer|like|want|need)\s+([^.!?]+)/gi,
            /(?:please|always|never)\s+([^.!?]+)/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[0].length < 100) {
                    preferences.push(match[0].trim());
                }
            }
        }

        return preferences.slice(0, 3);
    }

    private extractDecisions(text: string): string[] {
        const decisions: string[] = [];
        
        // Look for decision patterns
        const patterns = [
            /(?:we|I)\s+(?:decided|chose|agreed|will)\s+(?:to\s+)?([^.!?]+)/gi,
            /(?:let's|let us)\s+([^.!?]+)/gi,
            /(?:the plan is|we're going)\s+(?:to\s+)?([^.!?]+)/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[0].length < 100) {
                    decisions.push(match[0].trim());
                }
            }
        }

        return decisions.slice(0, 3);
    }
}

// =============================================================================
// Factory Function
// =============================================================================

const memoryManagers: Map<string, MemoryManager> = new Map();

export function getMemoryManager(userId: string): MemoryManager {
    if (!memoryManagers.has(userId)) {
        memoryManagers.set(userId, new MemoryManager(userId));
    }
    return memoryManagers.get(userId)!;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Store a memory for a user
 */
export async function storeMemory(
    userId: string,
    memory: Omit<MemoryItem, 'id' | 'timestamp'>
): Promise<MemoryItem> {
    const manager = getMemoryManager(userId);
    return manager.store(memory);
}

/**
 * Get relevant memories for a query
 */
export async function getRelevantMemories(
    userId: string,
    queryText: string,
    limit: number = 10
): Promise<MemoryItem[]> {
    const manager = getMemoryManager(userId);
    return manager.getRelevant(queryText, limit);
}

/**
 * Build agent memory context
 */
export async function buildMemoryContext(
    userId: string,
    queryText?: string
): Promise<AgentMemory> {
    const manager = getMemoryManager(userId);
    return manager.buildAgentMemory(queryText);
}

/**
 * Extract and store memories from a conversation
 */
export async function learnFromConversation(
    userId: string,
    messages: { role: string; content: string }[],
    agentRole: AgentRole
): Promise<MemoryItem[]> {
    const manager = getMemoryManager(userId);
    return manager.extractFromConversation(messages, agentRole);
}
