// lib/agents/memory.ts
// Cross-Context Memory - Shared knowledge across conversations
// Enhanced with Semantic Search using OpenAI Embeddings

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
    useSemantic?: boolean; // Use embedding-based search
}

// Scored memory with similarity - all fields required
export interface ScoredMemory {
    id: string;
    type: MemoryItem['type'];
    content: string;
    source: AgentRole;
    relevance: number;
    metadata: Record<string, any>;
    timestamp: Date;
    similarity: number;
}

// =============================================================================
// Embedding Generation
// =============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text.slice(0, 8000), // Limit input length
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Memory] Embedding API error:', error);
            throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } catch (error) {
        console.error('[Memory] Failed to generate embedding:', error);
        throw error;
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
     * Store a new memory with optional embedding
     */
    async store(
        memory: Omit<MemoryItem, 'id' | 'timestamp'>,
        generateEmbed: boolean = true
    ): Promise<MemoryItem> {
        const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date();

        const item: MemoryItem = {
            id,
            timestamp,
            ...memory,
        };

        try {
            // Generate embedding if requested
            let embedding: number[] | null = null;
            if (generateEmbed && memory.content.length > 10) {
                try {
                    embedding = await generateEmbedding(memory.content);
                } catch (e) {
                    console.warn('[Memory] Skipping embedding generation:', e);
                }
            }

            await query(`
                INSERT INTO agent_memories (
                    id, user_id, type, content, source, relevance, metadata, 
                    embedding, embedding_model, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                id,
                this.userId,
                memory.type,
                memory.content,
                memory.source,
                memory.relevance || 0.5,
                JSON.stringify(memory.metadata || {}),
                embedding ? JSON.stringify(embedding) : null,
                embedding ? EMBEDDING_MODEL : null,
                timestamp,
            ]);

            // Invalidate cache
            this.cache.clear();

            console.log(`[Memory] ✅ Stored: ${memory.type} (${embedding ? 'with embedding' : 'no embedding'})`);
            return item;
        } catch (error) {
            console.error('[Memory] Failed to store memory:', error);
            throw error;
        }
    }

    /**
     * Semantic search using embeddings
     */
    async semanticSearch(
        queryText: string,
        limit: number = 10,
        minSimilarity: number = 0.5
    ): Promise<ScoredMemory[]> {
        try {
            // Generate query embedding
            const queryEmbedding = await generateEmbedding(queryText);

            // Get all memories with embeddings for this user
            const rows = await query(`
                SELECT id, type, content, source, relevance, metadata, 
                       embedding, created_at as timestamp
                FROM agent_memories
                WHERE user_id = $1 AND embedding IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 100
            `, [this.userId]);

            if (rows.length === 0) {
                console.log('[Memory] No embeddings found, falling back to keyword search');
                return [];
            }

            // Calculate similarities and filter
            const scored: ScoredMemory[] = [];
            
            for (const row of rows) {
                let embedding: number[] = [];
                try {
                    embedding = typeof row.embedding === 'string' 
                        ? JSON.parse(row.embedding) 
                        : row.embedding;
                } catch {
                    continue;
                }

                if (!embedding || embedding.length !== EMBEDDING_DIMENSION) {
                    continue;
                }

                const similarity = cosineSimilarity(queryEmbedding, embedding);
                
                if (similarity >= minSimilarity) {
                    scored.push({
                        id: row.id,
                        type: row.type as MemoryItem['type'],
                        content: row.content,
                        source: row.source as AgentRole,
                        relevance: parseFloat(row.relevance) || 0.5,
                        metadata: typeof row.metadata === 'string' 
                            ? JSON.parse(row.metadata) 
                            : (row.metadata || {}),
                        timestamp: new Date(row.timestamp),
                        similarity,
                    });
                }
            }

            // Sort by similarity and return top results
            scored.sort((a, b) => b.similarity - a.similarity);
            
            console.log(`[Memory] Semantic search: ${scored.length} results above ${minSimilarity} threshold`);
            return scored.slice(0, limit);

        } catch (error) {
            console.error('[Memory] Semantic search failed:', error);
            return [];
        }
    }

    /**
     * Retrieve memories based on search options
     */
    async retrieve(options: MemorySearchOptions = {}): Promise<MemoryItem[]> {
        // Use semantic search if requested
        if (options.useSemantic && options.query) {
            const results = await this.semanticSearch(
                options.query,
                options.limit || 10,
                options.minRelevance || 0.5
            );
            return results;
        }

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

            // Text search (keyword-based)
            if (options.query && !options.useSemantic) {
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
     * Get memories relevant to a specific query (hybrid: semantic + keyword)
     */
    async getRelevant(queryText: string, limit: number = 10): Promise<MemoryItem[]> {
        // Try semantic search first
        const semanticResults = await this.semanticSearch(queryText, Math.ceil(limit / 2), 0.6);
        
        // Also do keyword search
        const keywords = this.extractKeywords(queryText);
        let keywordResults: MemoryItem[] = [];
        
        if (keywords.length > 0) {
            for (const keyword of keywords.slice(0, 3)) {
                const results = await this.retrieve({
                    query: keyword,
                    limit: Math.ceil(limit / 3),
                });
                keywordResults.push(...results);
            }
        }

        // Combine and deduplicate
        const allResults: MemoryItem[] = [...semanticResults, ...keywordResults];
        const uniqueResults = this.deduplicateMemories(allResults);
        
        console.log(`[Memory] Hybrid search: ${semanticResults.length} semantic + ${keywordResults.length} keyword = ${uniqueResults.length} unique`);
        return uniqueResults.slice(0, limit);
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
     * Consolidate similar memories (merge duplicates)
     */
    async consolidate(): Promise<{ merged: number; removed: number }> {
        try {
            // Get all memories with embeddings
            const memories = await this.retrieve({ limit: 500 });
            
            if (memories.length < 2) {
                return { merged: 0, removed: 0 };
            }

            const toRemove: string[] = [];
            const processed = new Set<string>();
            let merged = 0;

            // Find similar memories
            for (let i = 0; i < memories.length; i++) {
                if (processed.has(memories[i].id)) continue;

                const similar: MemoryItem[] = [];
                
                for (let j = i + 1; j < memories.length; j++) {
                    if (processed.has(memories[j].id)) continue;
                    
                    // Check if content is similar (simple Jaccard similarity)
                    const similarity = this.textSimilarity(
                        memories[i].content, 
                        memories[j].content
                    );
                    
                    if (similarity > 0.7) {
                        similar.push(memories[j]);
                        processed.add(memories[j].id);
                    }
                }

                // Merge similar memories
                if (similar.length > 0) {
                    // Keep the one with highest relevance
                    const allSimilar = [memories[i], ...similar];
                    allSimilar.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
                    
                    const keeper = allSimilar[0];
                    const toDelete = allSimilar.slice(1);
                    
                    // Boost relevance of keeper
                    await this.updateRelevance(keeper.id, 0.1 * toDelete.length);
                    
                    // Mark others for deletion
                    toRemove.push(...toDelete.map(m => m.id));
                    merged += toDelete.length;
                }
                
                processed.add(memories[i].id);
            }

            // Delete merged memories
            if (toRemove.length > 0) {
                await query(`
                    DELETE FROM agent_memories
                    WHERE id = ANY($1) AND user_id = $2
                `, [toRemove, this.userId]);
            }

            this.cache.clear();
            console.log(`[Memory] Consolidation: merged ${merged}, removed ${toRemove.length}`);
            
            return { merged, removed: toRemove.length };

        } catch (error) {
            console.error('[Memory] Consolidation failed:', error);
            return { merged: 0, removed: 0 };
        }
    }

    /**
     * Apply relevance decay to old memories
     */
    async applyDecay(daysThreshold: number = 30, decayFactor: number = 0.1): Promise<number> {
        try {
            const result = await query(`
                UPDATE agent_memories
                SET relevance = GREATEST(0.1, relevance - $1),
                    updated_at = NOW()
                WHERE user_id = $2 
                  AND updated_at < NOW() - INTERVAL '1 day' * $3
                  AND relevance > 0.1
                RETURNING id
            `, [decayFactor, this.userId, daysThreshold]);

            this.cache.clear();
            console.log(`[Memory] Decay applied to ${result.length} memories`);
            return result.length;

        } catch (error) {
            console.error('[Memory] Decay failed:', error);
            return 0;
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

        // Get relevant memories using hybrid search if query provided
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
            // Skip short messages
            if (message.content.length < 20) continue;

            // Extract facts
            const facts = this.extractFacts(message.content);
            for (const fact of facts) {
                const item = await this.store({
                    type: 'fact',
                    content: fact,
                    source: agentRole,
                    relevance: 0.6,
                }, true); // Generate embedding
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
                }, true);
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
                }, true);
                extracted.push(item);
            }
        }

        // Run consolidation after extraction to merge duplicates
        if (extracted.length > 5) {
            await this.consolidate();
        }

        return extracted;
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private extractKeywords(text: string): string[] {
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

    private textSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);
        
        return intersection.size / union.size; // Jaccard similarity
    }

    private extractFacts(text: string): string[] {
        const facts: string[] = [];
        
        const patterns = [
            /(?:my|our|the)\s+(\w+)\s+is\s+([^.!?]+)/gi,
            /(?:I|we)\s+(?:work|live|am)\s+(?:at|in)\s+([^.!?]+)/gi,
            /(?:the|our)\s+(?:company|team|project)\s+([^.!?]+)/gi,
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[0].length < 100) {
                    facts.push(match[0].trim());
                }
            }
        }

        return facts.slice(0, 5);
    }

    private extractPreferences(text: string): string[] {
        const preferences: string[] = [];
        
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
 * Store a memory for a user (with embedding)
 */
export async function storeMemory(
    userId: string,
    memory: Omit<MemoryItem, 'id' | 'timestamp'>,
    generateEmbedding: boolean = true
): Promise<MemoryItem> {
    const manager = getMemoryManager(userId);
    return manager.store(memory, generateEmbedding);
}

/**
 * Semantic search for memories
 */
export async function searchMemoriesSemantic(
    userId: string,
    queryText: string,
    limit: number = 10
): Promise<ScoredMemory[]> {
    const manager = getMemoryManager(userId);
    return manager.semanticSearch(queryText, limit);
}

/**
 * Get relevant memories for a query (hybrid search)
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

/**
 * Consolidate duplicate memories
 */
export async function consolidateMemories(userId: string): Promise<{ merged: number; removed: number }> {
    const manager = getMemoryManager(userId);
    return manager.consolidate();
}

/**
 * Apply decay to old memories
 */
export async function decayOldMemories(
    userId: string,
    daysThreshold: number = 30
): Promise<number> {
    const manager = getMemoryManager(userId);
    return manager.applyDecay(daysThreshold);
}
