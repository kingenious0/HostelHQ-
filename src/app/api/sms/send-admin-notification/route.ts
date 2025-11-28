import { NextRequest, NextResponse } from 'next/server';
import { sendAdminSMSNotification } from '@/lib/sms-service';

export async function POST(request: NextRequest) {
  try {
    const { to, message, type } = await request.json();

    if (!to || !to.length || !message) {
      return NextResponse.json(
        { success: false, error: 'Recipients and message are required' },
        { status: 400 }
      );
    }

    // Send SMS using the admin SMS service (which uses Wigal)
    const result = await sendAdminSMSNotification({ to, message, type });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error sending admin SMS notification:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
