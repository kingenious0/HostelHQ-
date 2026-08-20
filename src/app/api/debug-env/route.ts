import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug route to check if environment variables are loaded
 * This helps identify if env vars are accessible in the API route context
 * 
 * Usage: GET /api/debug-env
 * 
 * Note: Only use this in development. Remove in production or add authentication.
 */
export async function GET(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  // Check all possible environment variable names (case variations)
  const envCheck = {
    // Expected names
    WIGAL_API_KEY: {
      exists: !!process.env.WIGAL_API_KEY,
      length: process.env.WIGAL_API_KEY?.length || 0,
      firstChars: process.env.WIGAL_API_KEY?.substring(0, 4) + '...' || 'N/A',
      lastChars: process.env.WIGAL_API_KEY?.substring(process.env.WIGAL_API_KEY.length - 4) || 'N/A',
    },
    WIGAL_USERNAME: {
      exists: !!process.env.WIGAL_USERNAME,
      length: process.env.WIGAL_USERNAME?.length || 0,
      value: process.env.WIGAL_USERNAME || 'N/A',
    },
    WIGAL_API_URL: {
      exists: !!process.env.WIGAL_API_URL,
      value: process.env.WIGAL_API_URL || 'N/A',
    },
    WIGAL_SENDER_ID: {
      exists: !!process.env.WIGAL_SENDER_ID,
      value: process.env.WIGAL_SENDER_ID || 'N/A',
    },
    // Check for common variations
    NEXT_PUBLIC_WIGAL_API_KEY: {
      exists: !!process.env.NEXT_PUBLIC_WIGAL_API_KEY,
      note: 'Should NOT use NEXT_PUBLIC_ prefix for server-side secrets',
    },
    NEXT_PUBLIC_WIGAL_USERNAME: {
      exists: !!process.env.NEXT_PUBLIC_WIGAL_USERNAME,
      note: 'Should NOT use NEXT_PUBLIC_ prefix for server-side secrets',
    },
  };

  // Check if .env.local file might exist
  const recommendations = [];
  
  if (!envCheck.WIGAL_API_KEY.exists) {
    recommendations.push('❌ WIGAL_API_KEY is not set. Add it to .env.local file in the project root.');
  }
  
  if (!envCheck.WIGAL_USERNAME.exists) {
    recommendations.push('❌ WIGAL_USERNAME is not set. Add it to .env.local file in the project root.');
  }
  
  if (envCheck.WIGAL_API_KEY.exists && envCheck.WIGAL_API_KEY.length < 10) {
    recommendations.push('⚠️ WIGAL_API_KEY seems too short. Verify it is correct.');
  }
  
  if (envCheck.WIGAL_USERNAME.exists && envCheck.WIGAL_USERNAME.length < 3) {
    recommendations.push('⚠️ WIGAL_USERNAME seems too short. Verify it is correct.');
  }
  
  if (envCheck.WIGAL_API_KEY.exists && envCheck.WIGAL_USERNAME.exists) {
    recommendations.push('✅ Environment variables are loaded. If you still get auth errors, verify the credentials are correct in your Wigal account.');
    recommendations.push('⚠️ Make sure you RESTARTED the Next.js server after adding/updating .env.local');
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    envVariables: envCheck,
    recommendations,
    troubleshooting: {
      steps: [
        '1. Verify .env.local file exists in project root (same directory as package.json)',
        '2. Check for typos in variable names (case-sensitive, no spaces)',
        '3. Ensure no quotes around values in .env.local (unless value contains spaces)',
        '4. Restart Next.js server after changing .env.local',
        '5. Verify credentials in Wigal dashboard',
        '6. Check server console logs for detailed error messages',
      ],
      exampleEnvFile: `
# .env.local (in project root)
WIGAL_API_KEY=your_api_key_here
WIGAL_USERNAME=your_username_here
WIGAL_API_URL=https://frogapi.wigal.com.gh
WIGAL_SENDER_ID=HostelHQ
      `.trim(),
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

