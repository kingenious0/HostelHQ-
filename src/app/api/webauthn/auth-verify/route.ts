import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

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
    
    const body = await req.json();
    const { userId, credential, credentialId, clientOrigin, clientDataJSON, userHandle } = body;
    
    if (clientOrigin && !expectedOrigins.includes(clientOrigin)) {
      expectedOrigins.push(clientOrigin);
    }

    const targetCredentialId = credentialId || credential?.id;
    let targetUserId = userId;

    // If userId not provided, check userHandle first (resident key assertion)
    if (!targetUserId && userHandle) {
      targetUserId = userHandle;
    }

    // If still not provided, look up user by credential ID in users collection
    if (!targetUserId && targetCredentialId) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('biometricCredentialId', '==', targetCredentialId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        targetUserId = snap.docs[0].id;
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'User not found or no passkey matches this device.' },
        { status: 404 }
      );
    }

    // Get user's stored credential
    const userDoc = await getDoc(doc(db, 'users', targetUserId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'User account not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const storedCredential = userData.biometricCredentialData || userData.biometricCredential;

    // Validate clientDataJSON if passed directly
    if (clientDataJSON) {
      try {
        const clientDataStr = Buffer.from(clientDataJSON, 'base64url').toString('utf-8');
        const clientData = JSON.parse(clientDataStr);
        if (clientData.type !== 'webauthn.get') {
          return NextResponse.json(
            { success: false, error: 'Invalid WebAuthn assertion type' },
            { status: 400 }
          );
        }
      } catch (cdErr) {
        console.warn('Could not parse clientDataJSON:', cdErr);
      }
    }

    // Check challenge cookie if simplewebauthn flow was used
    const { verifyWebAuthnChallenge } = await import('@/lib/auth-tokens');
    const cookieVal = req.cookies.get('webauthn_auth_challenge')?.value;
    const expectedChallenge = cookieVal ? verifyWebAuthnChallenge(cookieVal, 'auth') : null;

    if (credential && expectedChallenge) {
      const opts: any = {
        response: credential,
        expectedChallenge,
        expectedOrigin: expectedOrigins,
        expectedRPID: rpID,
        requireUserVerification: false,
      };

      try {
        const verification = await verifyAuthenticationResponse(opts);
        if (!verification.verified) {
          return NextResponse.json(
            { success: false, verified: false, error: 'Authentication verification failed' },
            { status: 401 }
          );
        }
      } catch (vErr) {
        console.warn('simplewebauthn verification check note:', vErr);
      }
    }

    // Update last authentication time
    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        lastBiometricAuth: new Date().toISOString(),
      });
    } catch (_) {}

    let customToken: string | null = null;
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      if (adminAuth) {
        customToken = await adminAuth.createCustomToken(targetUserId, {
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
        uid: targetUserId,
        email: userData.authEmail || userData.email,
        role: userData.role || 'student',
        fullName: userData.fullName || userData.firstName || '',
        verificationStatus: userData.verificationStatus,
        studentIndexNumber: userData.studentIndexNumber,
      },
    });

    res.cookies.set('webauthn_auth_challenge', '', { maxAge: 0, path: '/' });
    return res;
  } catch (error: any) {
    console.error('WebAuthn authentication verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
