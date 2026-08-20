import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const rpName = 'HostelHQ';

export async function POST(req: NextRequest) {
  try {
    const { userId, credential, clientOrigin } = await req.json();

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
      rpID = host; // Preview/staging domains (use full domain)
    } else {
      rpID = host; // Fallback to full domain
    }
    
    // Determine the expected origin
    // For Android WebView, we need to accept both the web origin and android:apk-key-hash origin
    let origin = `${protocol}://${host}`;
    
    // Build list of expected origins (for Android WebView compatibility)
    const expectedOrigins: string[] = [origin];
    
    // For Android, also accept the client-reported origin if it's an android: scheme
    if (isAndroidWebView && clientOrigin && clientOrigin.startsWith('android:')) {
      expectedOrigins.push(clientOrigin);
    }
    
    console.log('WebAuthn Verify Config:', { 
      rpID, 
      origin, 
      expectedOrigins,
      host, 
      environment: process.env.NODE_ENV,
      isAndroidWebView,
      userAgent: userAgent.substring(0, 100),
      clientOrigin
    });

    if (!userId || !credential) {
      return NextResponse.json(
        { success: false, error: 'User ID and credential are required' },
        { status: 400 }
      );
    }

    // Extract challenge from the credential response
    // During signup, user might not exist in Firestore yet, so we get challenge from the credential
    const expectedChallenge = credential.response.clientDataJSON 
      ? JSON.parse(atob(credential.response.clientDataJSON)).challenge
      : null;

    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Invalid challenge' },
        { status: 400 }
      );
    }

    console.log('WebAuthn verification attempt:', { 
      userId, 
      hasCredential: !!credential, 
      hasChallenge: !!expectedChallenge,
      rpID,
      expectedOrigins 
    });

    const opts: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge,
      expectedOrigin: expectedOrigins, // Accept multiple origins for Android WebView
      expectedRPID: rpID,
      requireUserVerification: true,
    };

    const verification = await verifyRegistrationResponse(opts);

    console.log('WebAuthn verification result:', { 
      verified: verification.verified, 
      hasRegistrationInfo: !!verification.registrationInfo 
    });

    if (verification.verified && verification.registrationInfo) {
      const registrationInfo = verification.registrationInfo;
      
      // Store the credential in Firestore if user doc already exists (e.g., re-register)
      const biometricCredential = {
        id: Buffer.from(registrationInfo.credential.id).toString('base64url'),
        publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
        counter: registrationInfo.credential.counter || 0,
        deviceType: 'platform',
        backedUp: registrationInfo.credentialBackedUp || false,
        transports: credential.response?.transports || ['internal'],
        createdAt: new Date().toISOString(),
      };

      // Only update if doc exists to avoid NOT_FOUND errors during initial signup
      try {
        const userRef = doc(db, 'users', userId);
        const existing = await getDoc(userRef);
        if (existing.exists()) {
          await updateDoc(userRef, {
            biometricCredential,
            biometricSetupDate: new Date().toISOString(),
            hasBiometric: true,
          });
        } else {
          console.log('User doc does not exist yet; client will attach credential during signup:', userId);
        }
      } catch (checkError) {
        console.warn('Skipping immediate user update; will attach during signup. Reason:', checkError);
      }

      return NextResponse.json({
        success: true,
        verified: true,
        credential: biometricCredential,
      });
    } else {
      console.error('WebAuthn verification failed:', {
        verified: verification.verified,
        registrationInfo: verification.registrationInfo,
        error: verification
      });
      return NextResponse.json(
        { success: false, error: 'Failed to verify registration', details: verification },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('WebAuthn registration verification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to verify registration',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
