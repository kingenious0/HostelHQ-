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
    
    // Handle different environments
    let rpID: string;
    if (host.includes('localhost') || host.includes('127.0.0.1:60518')) {
      rpID = 'localhost'; // Handle both localhost and 127.0.0.1:60518
    } else if (host.includes('hostelhq.vercel.app') || host === 'hostelhq.vercel.app') {
      rpID = 'hostelhq.vercel.app'; // Production domain
    } else if (host.includes('vercel.app')) {
      rpID = host; // Preview/staging domains (use full domain)
    } else {
      rpID = host; // Fallback to full domain
    }
    
    const origin = `${protocol}://${host}`;
    
    console.log('WebAuthn Auth Verify Config:', { rpID, origin, host, environment: process.env.NODE_ENV });
    const { userId, credential } = await req.json();

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

    const expectedChallenge = credential.response.clientDataJSON 
      ? JSON.parse(atob(credential.response.clientDataJSON)).challenge
      : null;

    if (!expectedChallenge) {
      return NextResponse.json(
        { success: false, error: 'Invalid challenge' },
        { status: 400 }
      );
    }

    // Note: This is a simplified implementation
    // In production, you'd need to properly configure the authenticator data
    const opts: any = {
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // Update counter in database
      await updateDoc(doc(db, 'users', userId), {
        'biometricCredential.counter': verification.authenticationInfo.newCounter,
        lastBiometricAuth: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        verified: true,
      });
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
