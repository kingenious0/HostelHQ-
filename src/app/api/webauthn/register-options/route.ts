import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';

const rpName = 'HostelHQ';
const rpID = process.env.NODE_ENV === 'development' ? 'localhost' : 'hostelhq.vercel.app';
const origin = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : 'https://hostelhq.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const { userId, userName } = await req.json();

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
      excludeCredentials: [], // TODO: Add existing credentials to prevent duplicates
      authenticatorSelection: {
        residentKey: 'discouraged',
        userVerification: 'required',
        authenticatorAttachment: 'platform', // Prefer platform authenticators (fingerprint, Face ID)
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
    };

    const options = await generateRegistrationOptions(opts);

    // Store challenge temporarily (in production, use Redis or database)
    // For now, we'll return it and verify it in the next step
    
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
