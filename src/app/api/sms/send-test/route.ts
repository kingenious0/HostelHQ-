import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone, message, adminName } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    // 🔧 DEVELOPMENT MODE: Bypass SMS - only works in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('🔧 DEV MODE: SMS bypassed - will work in production');
      console.log('📱 Would send to:', phone);
      console.log('📄 Message:', message);
      
      return NextResponse.json({
        success: true,
        message: 'SMS test successful (Development mode - will send in production)',
        devMode: true,
        debug: {
          phone: phone.replace(/(\d{3})\d{6}(\d{1})/, '$1******$2'),
          messageLength: message.length,
          note: 'SMS will be sent when deployed to production'
        }
      });
    }

    // 🚀 PRODUCTION MODE: Use real SMS API (only works when deployed)
    const { sendSMS } = await import('@/lib/wigal');
    
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
