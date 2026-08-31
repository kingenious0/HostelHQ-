import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required.' },
      { status: 401 }
    );
  }

  try {
    const { to, message, type } = await request.json();

    if (!to || !to.length || !message) {
      return NextResponse.json(
        { success: false, error: 'Recipients and message are required' },
        { status: 400 }
      );
    }

    // 🔧 DEVELOPMENT MODE: Bypass SMS - only works in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      console.log('🔧 DEV MODE: Admin SMS bypassed - will work in production');
      console.log('📱 Would send to:', to);
      console.log('📄 Message:', message);
      console.log('📋 Type:', type);
      
      return NextResponse.json({
        success: true,
        message: `Admin SMS notification simulated (${to.length} recipient(s)) - will send in production`,
        devMode: true,
        debug: {
          recipientCount: to.length,
          messageLength: message.length,
          type: type,
          note: 'SMS will be sent when deployed to production'
        }
      });
    }

    // 🚀 PRODUCTION MODE: Use real SMS API
    const { sendAdminSMSNotification } = await import('@/lib/sms-service');
    
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
