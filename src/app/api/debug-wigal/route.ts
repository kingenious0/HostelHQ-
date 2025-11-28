import { NextResponse } from 'next/server';

export async function GET() {
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
