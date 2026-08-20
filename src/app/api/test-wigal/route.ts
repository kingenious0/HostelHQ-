import { NextRequest, NextResponse } from 'next/server';

/**
 * Test route to verify Wigal API configuration
 * This helps debug authentication and configuration issues
 * 
 * Usage: GET /api/test-wigal
 * 
 * Note: This is for development/testing only. Remove or secure this route in production.
 */
export async function GET(req: NextRequest) {
  // Security check - only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    );
  }

  const config = {
    hasApiKey: !!process.env.WIGAL_API_KEY,
    hasUsername: !!process.env.WIGAL_USERNAME,
    apiUrl: process.env.WIGAL_API_URL || 'https://frogapi.wigal.com.gh',
    senderId: process.env.WIGAL_SENDER_ID || 'HostelHQ',
    apiKeyLength: process.env.WIGAL_API_KEY?.length || 0,
    usernameLength: process.env.WIGAL_USERNAME?.length || 0,
    // Don't expose actual values for security
  };

  // Test API connection
  let apiTest = {
    reachable: false,
    error: null as string | null,
    response: null as any,
  };

  if (config.hasApiKey && config.hasUsername) {
    try {
      // Try a simple test request (you might need to adjust this based on available test endpoints)
      const testUrl = `${config.apiUrl}/api/v3/sms/otp/generate`;
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-KEY': process.env.WIGAL_API_KEY!,
          'USERNAME': process.env.WIGAL_USERNAME!,
        },
        body: JSON.stringify({
          number: '0542709440', // Test number
          expiry: 10,
          length: 6,
          messagetemplate: 'Test: %OTPCODE%',
          type: 'NUMERIC',
          senderid: config.senderId,
        }),
      });

      apiTest.reachable = true;
      const responseText = await testResponse.text();
      try {
        apiTest.response = JSON.parse(responseText);
      } catch {
        apiTest.response = { raw: responseText };
      }
      apiTest.response.status = testResponse.status;
      apiTest.response.statusText = testResponse.statusText;
    } catch (error: any) {
      apiTest.error = error.message;
      apiTest.reachable = false;
    }
  }

  return NextResponse.json({
    config,
    apiTest,
    recommendations: [
      !config.hasApiKey && 'Set WIGAL_API_KEY in .env.local',
      !config.hasUsername && 'Set WIGAL_USERNAME in .env.local',
      config.hasApiKey && config.apiKeyLength < 10 && 'WIGAL_API_KEY seems too short',
      config.hasUsername && config.usernameLength < 3 && 'WIGAL_USERNAME seems too short',
      !apiTest.reachable && config.hasApiKey && config.hasUsername && 'Check API URL and network connectivity',
    ].filter(Boolean),
  });
}

