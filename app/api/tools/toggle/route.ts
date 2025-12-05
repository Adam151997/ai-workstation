// app/api/tools/toggle/route.ts - Toggle a single tool on/off
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { toggleUserTool } from '@/app/actions/tools';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/tools/toggle
 * Toggle a single tool on/off for the user
 * Body: { slug: string, enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { slug, enabled } = body;

    if (!slug || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: slug and enabled are required' },
        { status: 400 }
      );
    }

    console.log(`[ToggleTool API] 🔄 ${enabled ? 'Enabling' : 'Disabling'} tool: ${slug}`);

    const result = await toggleUserTool(slug, enabled, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log(`[ToggleTool API] ✅ Tool ${slug} ${enabled ? 'enabled' : 'disabled'}`);

    return NextResponse.json({
      success: true,
      message: result.message,
      slug,
      enabled
    });

  } catch (error: any) {
    console.error('[ToggleTool API] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
