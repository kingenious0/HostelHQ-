import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/wigal';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(req);
    const { phoneNumber, message } = await req.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    // Only admins or the authenticated user themselves can trigger notifications
    if (caller.role !== 'admin') {
      const callerPhone = caller.phone ? caller.phone.replace(/[^0-9]/g, '') : '';
      const destPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (callerPhone && !destPhone.endsWith(callerPhone.slice(-9))) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: You can only dispatch notifications to your verified phone number.' },
          { status: 403 }
        );
      }
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
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

