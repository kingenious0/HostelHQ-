import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/wigal';

export async function POST(request: NextRequest) {
  try {
    const { phone, message, adminName } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    // Send SMS using Wigal FROG service
    const result = await sendSMS(phone, message, `TEST${Date.now()}`);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test SMS sent successfully via Wigal FROG'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send test SMS'
      });
    }
  } catch (error: any) {
    console.error('Error sending test SMS:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
