import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    // Get the actual domain from the request
    const host = req.headers.get('host') || 'localhost:8080';
    
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
    
    console.log('WebAuthn Auth Options Config:', { rpID, host, environment: process.env.NODE_ENV });

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user's registered credentials
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    // Check for biometric credential data (new format) or legacy format
    const biometricCredential = userData.biometricCredentialData || userData.biometricCredential;
    const credentialId = userData.biometricCredentialId || biometricCredential?.id;

    if (!credentialId && !biometricCredential) {
      return NextResponse.json(
        { success: false, error: 'No biometric credentials found for user' },
        { status: 404 }
      );
    }

    const allowCredentials = [{
      id: credentialId || biometricCredential.id,
      type: 'public-key' as const,
      transports: biometricCredential?.transports || ['internal'],
    }];

    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      allowCredentials,
      userVerification: 'required',
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error: any) {
    console.error('WebAuthn authentication options error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
