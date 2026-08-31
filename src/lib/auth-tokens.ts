import * as crypto from 'crypto';

/**
 * Server secret used for signing HMAC tokens.
 * Falls back gracefully to standard available secrets if custom secret is not defined in env.
 */
function getSigningSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.FIREBASE_PRIVATE_KEY?.slice(0, 32) ||
    'hostelhq-secure-signing-key-default-2026'
  );
}

export interface PasswordResetPayload {
  userId: string;
  phoneNumber?: string;
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Generates a tamper-proof cryptographically signed token for password resets.
 * Valid for 15 minutes after SMS OTP verification.
 */
export function generatePasswordResetToken(userId: string, phoneNumber?: string): string {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const payload: PasswordResetPayload = { userId, phoneNumber, expiresAt };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', getSigningSecret());
  hmac.update(`pwd_reset:${payloadStr}`);
  const signature = hmac.digest('base64url');
  
  return `${payloadStr}.${signature}`;
}

/**
 * Validates a password reset token for a specific user ID.
 * Ensures the token hasn't expired, signature is valid, and matches the target user.
 */
export function verifyPasswordResetToken(token: string, expectedUserId: string): { valid: boolean; error?: string } {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Invalid token format' };
  }

  const [payloadStr, signature] = token.split('.');
  
  // Verify HMAC signature
  const hmac = crypto.createHmac('sha256', getSigningSecret());
  hmac.update(`pwd_reset:${payloadStr}`);
  const expectedSig = hmac.digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  try {
    const payload: PasswordResetPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'Password reset token has expired' };
    }

    if (payload.userId !== expectedUserId) {
      return { valid: false, error: 'Token does not match target user' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed token payload' };
  }
}

/**
 * Signs a WebAuthn challenge for safe HttpOnly cookie storage.
 */
export function signWebAuthnChallenge(challenge: string, type: 'register' | 'auth'): string {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  const data = `${type}:${challenge}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', getSigningSecret());
  hmac.update(data);
  const sig = hmac.digest('base64url');
  return `${Buffer.from(data).toString('base64url')}.${sig}`;
}

/**
 * Verifies and retrieves a WebAuthn challenge from its signed cookie string.
 */
export function verifyWebAuthnChallenge(signedValue: string, expectedType: 'register' | 'auth'): string | null {
  if (!signedValue || !signedValue.includes('.')) return null;

  const [dataStr, signature] = signedValue.split('.');
  const hmac = crypto.createHmac('sha256', getSigningSecret());
  try {
    const rawData = Buffer.from(dataStr, 'base64url').toString('utf8');
    hmac.update(rawData);
    const expectedSig = hmac.digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }

    const [type, challenge, expiresAtStr] = rawData.split(':');
    if (type !== expectedType) return null;
    if (Date.now() > parseInt(expiresAtStr, 10)) return null;

    return challenge;
  } catch {
    return null;
  }
}
