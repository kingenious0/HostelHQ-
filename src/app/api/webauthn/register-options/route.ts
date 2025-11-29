import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';

const rpName = 'HostelHQ';

export async function POST(req: NextRequest) {
  try {
    const { userId, userName, clientOrigin } = await req.json();

    // Get the actual domain from the request
    const host = req.headers.get('host') || 'localhost:8080';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const userAgent = req.headers.get('user-agent') || '';
    
    // Detect if request is from Android WebView (Capacitor app)
    const isAndroidWebView = userAgent.includes('wv') || userAgent.includes('Android');
    
    // Handle different environments
    let rpID: string;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      rpID = 'localhost';
    } else if (host.includes('hostelhq.vercel.app') || host === 'hostelhq.vercel.app') {
      rpID = 'hostelhq.vercel.app'; // Production domain
    } else if (host.includes('vercel.app')) {
      rpID = host; // Preview/staging domains
    } else {
      rpID = host; // Fallback to full domain
    }
    
    const origin = `${protocol}://${host}`;
    
    console.log('WebAuthn Config:', { 
      rpID, 
      origin, 
      host, 
      environment: process.env.NODE_ENV,
      isAndroidWebView,
      userAgent: userAgent.substring(0, 100),
      clientOrigin
    });

    if (!userId || !userName) {
      return NextResponse.json(
        { success: false, error: 'User ID and name are required' },
        { status: 400 }
      );
    }

    // Convert userId to Uint8Array as required by WebAuthn
    const userIdBuffer = new TextEncoder().encode(userId);
    
    const opts: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userID: userIdBuffer,
      userName: userName,
      userDisplayName: userName,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: [],
      authenticatorSelection: {
        residentKey: 'discouraged',
        userVerification: 'required',
        // No authenticatorAttachment restriction - allows any authenticator (Android compatible)
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
    };

    const options = await generateRegistrationOptions(opts);
    
    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error: any) {
    console.error('WebAuthn registration options error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate registration options',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
