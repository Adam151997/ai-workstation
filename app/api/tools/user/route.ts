// app/api/tools/user/route.ts - Get and update user's enabled tools with Audit Logging
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserTools, updateUserTools, initializeUserTools } from '@/app/actions/tools';
import { logSettingsAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tools/user
 * Returns the current user's enabled tools
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[UserTools API] 👤 Fetching tools for user: ${userId}`);

    const result = await getUserTools(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // If user has no tools, initialize with default starter pack
    if (result.tools.length === 0) {
      console.log('[UserTools API] 🎁 No tools found, initializing starter pack...');
      const initResult = await initializeUserTools(userId, 'sales');
      
      if (initResult.success) {
        const updatedResult = await getUserTools(userId);
        return NextResponse.json({
          success: true,
          tools: updatedResult.tools,
          count: updatedResult.tools.length,
          initialized: true
        });
      }
    }

    console.log(`[UserTools API] ✅ Returning ${result.tools.length} enabled tools`);

    return NextResponse.json({
      success: true,
      tools: result.tools,
      count: result.tools.length,
      initialized: false
    });

  } catch (error: any) {
    console.error('[UserTools API] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/user
 * Update user's tool preferences
 * Body: { tools: string[] } - Array of tool slugs
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tools } = body;

    if (!Array.isArray(tools)) {
      return NextResponse.json(
        { error: 'Invalid request: tools must be an array' },
        { status: 400 }
      );
    }

    // Get current tools for audit comparison
    const currentResult = await getUserTools(userId);
    const previousTools = currentResult.success 
      ? currentResult.tools.map((t: any) => t.slug) 
      : [];

    console.log(`[UserTools API] 💾 Updating tools for user: ${userId}`);
    console.log(`[UserTools API] 📦 New toolkit: ${tools.join(', ')}`);

    const result = await updateUserTools(tools, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Calculate added and removed tools
    const added = tools.filter((t: string) => !previousTools.includes(t));
    const removed = previousTools.filter((t: string) => !tools.includes(t));

    // Audit log
    await logSettingsAction(userId, 'settings.tools_update', {
      previousCount: previousTools.length,
      newCount: tools.length,
      added: added.length > 0 ? added : undefined,
      removed: removed.length > 0 ? removed : undefined,
    }, request);

    console.log(`[UserTools API] ✅ Toolkit updated successfully`);

    return NextResponse.json({
      success: true,
      message: result.message,
      toolCount: result.toolCount
    });

  } catch (error: any) {
    console.error('[UserTools API] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
