// app/api/tools/categories/route.ts - Get tool categories
import { NextResponse } from 'next/server';
import { getToolCategories } from '@/app/actions/tools';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tools/categories
 * Returns all tool categories with counts
 */
export async function GET() {
  try {
    console.log('[Categories API] 📂 Fetching categories...');

    const result = await getToolCategories();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log(`[Categories API] ✅ Returning ${result.categories.length} categories`);

    return NextResponse.json({
      success: true,
      categories: result.categories,
      count: result.categories.length
    });

  } catch (error: any) {
    console.error('[Categories API] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
