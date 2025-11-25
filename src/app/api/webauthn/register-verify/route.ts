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
    const { userId, credential } = await req.json();

    // Get the actual domain from the request
    const host = req.headers.get('host') || 'localhost:8080';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    
    // Handle different environments
    let rpID: string;
    if (host.includes('localhost')) {
      rpID = 'localhost';
    } else if (host.includes('hostelhq.vercel.app') || host === 'hostelhq.vercel.app') {
      rpID = 'hostelhq.vercel.app'; // Production domain
    } else if (host.includes('vercel.app')) {
      rpID = host; // Preview/staging domains (use full domain)
    } else {
      rpID = host; // Fallback to full domain
    }
    
    const origin = `${protocol}://${host}`;
    
    console.log('WebAuthn Verify Config:', { rpID, origin, host, environment: process.env.NODE_ENV });

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
