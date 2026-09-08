import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    // Get the actual domain from the request
    const host = req.headers.get('host') || 'localhost:8080';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    
    // RP ID must be domain without port
    let rpID: string;
    const cleanHost = host.split(':')[0];
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
      rpID = 'localhost';
    } else {
      rpID = cleanHost;
    }
    
    const origin = `${protocol}://${host}`;
    const expectedOrigins: string[] = [origin];
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
    
    console.log('WebAuthn Auth Verify Config:', { rpID, origin, host, environment: process.env.NODE_ENV });
    const { userId, credential, clientOrigin } = await req.json();
    if (clientOrigin && !expectedOrigins.includes(clientOrigin)) {
      expectedOrigins.push(clientOrigin);
    }

    if (!userId || !credential) {
      return NextResponse.json(
        { success: false, error: 'User ID and credential are required' },
        { status: 400 }
      );
    }

    // Get user's stored credential
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const storedCredential = userData.biometricCredential;

    if (!storedCredential) {
      return NextResponse.json(
        { success: false, error: 'No biometric credentials found' },
        { status: 404 }
      );
    }

    // Verify challenge from the server-signed HttpOnly cookie
    const { verifyWebAuthnChallenge } = await import('@/lib/auth-tokens');
    const cookieVal = req.cookies.get('webauthn_auth_challenge')?.value;
    const expectedChallenge = cookieVal ? verifyWebAuthnChallenge(cookieVal, 'auth') : null;

    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Authentication challenge expired or invalid. Please retry.' },
        { status: 400 }
      );
    }

    // Note: This is a simplified implementation
    // In production, you'd need to properly configure the authenticator data
    const opts: any = {
      response: credential,
      expectedChallenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      requireUserVerification: false,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // Update counter in database
      await updateDoc(doc(db, 'users', userId), {
        'biometricCredential.counter': verification.authenticationInfo.newCounter,
        lastBiometricAuth: new Date().toISOString(),
      });

      let customToken: string | null = null;
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        if (adminAuth) {
          customToken = await adminAuth.createCustomToken(userId, {
            role: userData.role || 'student',
          });
        }
      } catch (tokenErr) {
        console.warn('Could not generate customToken in auth-verify:', tokenErr);
      }

      const res = NextResponse.json({
        success: true,
        verified: true,
        customToken,
        user: {
          uid: userId,
          email: userData.authEmail || userData.email,
          role: userData.role || 'student',
          fullName: userData.fullName || userData.firstName || '',
          verificationStatus: userData.verificationStatus,
          studentIndexNumber: userData.studentIndexNumber,
        },
      });
      res.cookies.set('webauthn_auth_challenge', '', { maxAge: 0, path: '/' });
      return res;
    } else {
      return NextResponse.json(
        { success: false, verified: false, error: 'Authentication failed' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('WebAuthn authentication verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
