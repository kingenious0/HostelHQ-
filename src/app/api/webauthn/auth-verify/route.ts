import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const rpID = process.env.NODE_ENV === 'development' ? 'localhost' : 'hostelhq.vercel.app';
const origin = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : 'https://hostelhq.vercel.app';

export async function POST(req: NextRequest) {
  try {
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
