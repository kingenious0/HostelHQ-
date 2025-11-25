import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

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

    // Get user document to retrieve the challenge
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
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

    const opts: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (verification.verified && verification.registrationInfo) {
      const registrationInfo = verification.registrationInfo;
      
      // Store the credential in Firestore
      const biometricCredential = {
        id: Buffer.from(registrationInfo.credential.id).toString('base64url'),
        publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
        counter: registrationInfo.credential.counter || 0,
        deviceType: 'platform',
        backedUp: registrationInfo.credentialBackedUp || false,
        transports: credential.response?.transports || ['internal'],
        createdAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'users', userId), {
        biometricCredential,
        biometricSetupDate: new Date().toISOString(),
        hasBiometric: true,
      });

      return NextResponse.json({
        success: true,
        verified: true,
        credential: biometricCredential,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to verify registration' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('WebAuthn registration verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify registration' },
      { status: 500 }
    );
  }
}
