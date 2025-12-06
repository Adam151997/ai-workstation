// app/api/setup/toolkits/fix-icons/route.ts
// Fix broken toolkit icons

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        // Fix Google Calendar icon
        await query(`
            UPDATE toolkit_catalog 
            SET icon_url = 'https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png'
            WHERE slug = 'google-calendar'
        `);

        // You can add more icon fixes here as needed

        return NextResponse.json({
            success: true,
            message: 'Icons fixed successfully',
            fixed: ['google-calendar'],
        });

    } catch (error: any) {
        console.error('[Fix Icons] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fix icons', details: error.message },
            { status: 500 }
        );
    }
}
