import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-guard';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin'], req);
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required.' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    wigalApiKey: !!process.env.WIGAL_API_KEY,
    wigalUsername: !!process.env.WIGAL_USERNAME,
    wigalApiUrl: process.env.WIGAL_API_URL || process.env.FROG_SMS_API_URL,
    wigalSenderId: process.env.WIGAL_SENDER_ID || process.env.FROG_SMS_SENDER_ID,
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}
