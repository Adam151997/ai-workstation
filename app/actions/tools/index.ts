// app/actions/tools/index.ts - Server Actions for Tool Management
'use server';

import { query } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

/**
 * Sync Composio tool catalog to database
 * This fetches all available integrations from Composio and stores them
 */
export async function syncToolCatalog() {
  try {
    console.log('[ToolSync] 🔄 Starting Composio catalog sync...');
    
    const result = await query('SELECT COUNT(*) as count FROM tool_catalog');
    const count = parseInt(result[0].count);
    
    console.log(`[ToolSync] ✅ Tool catalog has ${count} tools`);
    
    return {
      success: true,
      toolCount: count,
      message: `Catalog contains ${count} tools`
    };
    
  } catch (error: any) {
    console.error('[ToolSync] ❌ Sync failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all available tools from catalog
 * Optionally filter by category
 */
export async function getToolCatalog(category?: string) {
  try {
    let sql = 'SELECT * FROM tool_catalog';
    const params: any[] = [];
    
    if (category) {
      sql += ' WHERE category = $1';
      params.push(category);
    }
    
    sql += ' ORDER BY popularity_score DESC, name ASC';
    
    const tools = await query(sql, params);
    
    console.log(`[ToolCatalog] ✅ Found ${tools.length} tools`);
    
    return {
      success: true,
      tools: tools || []
    };
    
  } catch (error: any) {
    console.error('[ToolCatalog] ❌ Fetch failed:', error);
    return {
      success: false,
      error: error.message,
      tools: []
    };
  }
}

/**
 * Get user's enabled tools
 * Returns only tools the user has selected for their workspace
 */
export async function getUserTools(userId?: string) {
  try {
    // Get userId from Clerk if not provided
    if (!userId) {
      const { userId: clerkUserId } = await auth();
      if (!clerkUserId) {
        throw new Error('User not authenticated');
      }
      userId = clerkUserId;
    }
    
    const tools = await query(`
      SELECT 
        tc.id,
        tc.slug,
        tc.name,
        tc.description,
        tc.icon_url,
        tc.category,
        tc.is_premium,
        tc.requires_auth,
        utp.position,
        utp.notes,
        utp.is_enabled,
        utp.created_at as enabled_at
      FROM tool_catalog tc
      JOIN user_tool_preferences utp ON tc.slug = utp.tool_slug
      WHERE utp.user_id = $1 AND utp.is_enabled = true
      ORDER BY utp.position ASC, tc.name ASC
    `, [userId]);
    
    console.log(`[UserTools] ✅ Found ${tools.length} tools for user`);
    
    return {
      success: true,
      tools: tools || []
    };
    
  } catch (error: any) {
    console.error('[UserTools] ❌ Fetch failed:', error);
    return {
      success: false,
      error: error.message,
      tools: []
    };
  }
}

/**
 * Get user's tool slugs only (for API calls)
 * Returns simple array of enabled tool slugs
 */
export async function getUserToolSlugs(userId?: string): Promise<string[]> {
  try {
    const result = await getUserTools(userId);
    if (!result.success || !result.tools) return [];
    
    return result.tools.map((t: any) => t.slug);
  } catch (error) {
    console.error('[UserToolSlugs] ❌ Fetch failed:', error);
    return [];
  }
}

/**
 * Update user's tool preferences
 * Replaces entire toolkit with new selection
 */
export async function updateUserTools(toolSlugs: string[], userId?: string) {
  try {
    // Get userId from Clerk if not provided
    if (!userId) {
      const { userId: clerkUserId } = await auth();
      if (!clerkUserId) {
        throw new Error('User not authenticated');
      }
      userId = clerkUserId;
    }
    
    console.log(`[UserTools] 🔄 Updating toolkit for user ${userId}`);
    console.log(`[UserTools] 📦 New tools: ${toolSlugs.join(', ')}`);
    
    // Start transaction
    await query('BEGIN');
    
    // Delete old preferences
    await query('DELETE FROM user_tool_preferences WHERE user_id = $1', [userId]);
    
    // Insert new preferences with position
    for (let i = 0; i < toolSlugs.length; i++) {
      await query(`
        INSERT INTO user_tool_preferences (user_id, tool_slug, position, is_enabled)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, tool_slug) 
        DO UPDATE SET position = $3, is_enabled = true, updated_at = NOW()
      `, [userId, toolSlugs[i], i]);
    }
    
    // Update popularity scores
    await query(`
      UPDATE tool_catalog 
      SET popularity_score = popularity_score + 1 
      WHERE slug = ANY($1)
    `, [toolSlugs]);
    
    // Commit transaction
    await query('COMMIT');
    
    console.log(`[UserTools] ✅ Toolkit updated: ${toolSlugs.length} tools enabled`);
    
    return {
      success: true,
      message: `Successfully enabled ${toolSlugs.length} tools`,
      toolCount: toolSlugs.length
    };
    
  } catch (error: any) {
    await query('ROLLBACK');
    console.error('[UserTools] ❌ Update failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Toggle a single tool on/off for user
 */
export async function toggleUserTool(toolSlug: string, enabled: boolean, userId?: string) {
  try {
    if (!userId) {
      const { userId: clerkUserId } = await auth();
      if (!clerkUserId) {
        throw new Error('User not authenticated');
      }
      userId = clerkUserId;
    }
    
    await query(`
      INSERT INTO user_tool_preferences (user_id, tool_slug, is_enabled)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, tool_slug)
      DO UPDATE SET is_enabled = $3, updated_at = NOW()
    `, [userId, toolSlug, enabled]);
    
    console.log(`[UserTools] ✅ Tool ${toolSlug} ${enabled ? 'enabled' : 'disabled'}`);
    
    return {
      success: true,
      message: `Tool ${enabled ? 'enabled' : 'disabled'} successfully`
    };
    
  } catch (error: any) {
    console.error('[UserTools] ❌ Toggle failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get tool categories for filtering
 */
export async function getToolCategories() {
  try {
    const categories = await query(`
      SELECT DISTINCT category, COUNT(*) as tool_count
      FROM tool_catalog
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY tool_count DESC, category ASC
    `);
    
    console.log(`[ToolCategories] ✅ Found ${categories.length} categories`);
    
    return {
      success: true,
      categories: categories || []
    };
    
  } catch (error: any) {
    console.error('[ToolCategories] ❌ Fetch failed:', error);
    return {
      success: false,
      error: error.message,
      categories: []
    };
  }
}

/**
 * Initialize default tools for new user
 * Sets up starter toolkit based on common use cases
 */
export async function initializeUserTools(userId: string, starterPack: 'sales' | 'marketing' | 'admin' = 'sales') {
  try {
    const starterTools = {
      sales: ['hubspot', 'gmail', 'google_calendar', 'google_drive'],
      marketing: ['slack', 'google_sheets', 'gmail', 'notion'],
      admin: ['jira', 'slack', 'google_drive', 'asana']
    };
    
    const tools = starterTools[starterPack];
    
    const result = await updateUserTools(tools, userId);
    
    console.log(`[UserTools] ✅ Initialized ${starterPack} starter pack for user ${userId}`);
    
    return result;
    
  } catch (error: any) {
    console.error('[UserTools] ❌ Initialization failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
