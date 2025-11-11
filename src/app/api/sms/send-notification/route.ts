import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/wigal';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    const result = await sendSMS(phoneNumber, message);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send SMS' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
    });
  } catch (error: any) {
    console.error('Error in send-notification route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

