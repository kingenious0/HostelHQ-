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
    
    // RP ID must be domain without port
    let rpID: string;
    const cleanHost = host.split(':')[0];
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
      rpID = 'localhost';
    } else {
      rpID = cleanHost;
    }
    
    // Determine the expected origin
    let origin = `${protocol}://${host}`;
    
    // Build list of expected origins (for Android WebView & cross-protocol compatibility)
    const expectedOrigins: string[] = [origin];
    
    if (clientOrigin && !expectedOrigins.includes(clientOrigin)) {
      expectedOrigins.push(clientOrigin);
    }
    if (origin.startsWith('http://')) {
      expectedOrigins.push(origin.replace('http://', 'https://'));
    } else if (origin.startsWith('https://')) {
      expectedOrigins.push(origin.replace('https://', 'http://'));
    }
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
      expectedOrigins.push(
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:8080',
        'http://localhost:9002',
        'http://127.0.0.1:3000'
      );
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

    // Verify challenge from the server-signed HttpOnly cookie
    const { verifyWebAuthnChallenge } = await import('@/lib/auth-tokens');
    const cookieVal = req.cookies.get('webauthn_reg_challenge')?.value;
    const expectedChallenge = cookieVal ? verifyWebAuthnChallenge(cookieVal, 'register') : null;

    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Registration challenge expired or invalid. Please retry.' },
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
      expectedOrigin: expectedOrigins, // Accept multiple origins for Android WebView & web
      expectedRPID: rpID,
      requireUserVerification: false, // Match 'preferred' setting from registration options
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
            biometricCredentialId: biometricCredential.id,
            biometricCredentialData: biometricCredential,
            hasBiometricAuth: true,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (dbError) {
        console.warn('Could not update user document with biometric credential:', dbError);
      }

      const res = NextResponse.json({
        success: true,
        verified: true,
        credential: biometricCredential,
      });
      res.cookies.set('webauthn_reg_challenge', '', { maxAge: 0, path: '/' });
      return res;
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
