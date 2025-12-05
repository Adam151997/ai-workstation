// app/api/tools/catalog/route.ts - Get all available tools
import { NextRequest, NextResponse } from 'next/server';
import { getToolCatalog, getToolCategories } from '@/app/actions/tools';

export const maxDuration = 60;

/**
 * GET /api/tools/catalog
 * Returns all available tools from the catalog
 * 
 * Query params:
 * - category: Filter by category (optional)
 * - includeCategories: Include category list (optional)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const includeCategories = searchParams.get('includeCategories') === 'true';

    console.log('[API] 📦 Fetching tool catalog', category ? `(category: ${category})` : '');

    // Get tools
    const result = await getToolCatalog(category);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    // Optionally get categories
    let categories = undefined;
    if (includeCategories) {
      const categoriesResult = await getToolCategories();
      categories = categoriesResult.success ? categoriesResult.categories : [];
    }

    console.log(`[API] ✅ Returning ${result.tools.length} tools`);

    return NextResponse.json({
      success: true,
      tools: result.tools,
      count: result.tools.length,
      ...(categories && { categories })
    });

  } catch (error: any) {
    console.error('[API] ❌ Catalog fetch failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        tools: []
      },
      { status: 500 }
    );
  }
}
