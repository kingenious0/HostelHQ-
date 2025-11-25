/**
 * WebAuthn Utilities for Biometric Authentication
 * Supports: Fingerprint, Face ID, Windows Hello, etc.
 */

import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: string[];
}

/**
 * Check if the browser supports WebAuthn
 */
export function isBiometricSupported(): boolean {
  return (
    window?.PublicKeyCredential !== undefined &&
    navigator?.credentials !== undefined
  );
}

/**
 * Check if platform authenticator (fingerprint/Face ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
      console.log('WebAuthn not supported: PublicKeyCredential not available');
      return false;
    }

    // Check if platform authenticator is available (fingerprint, Face ID, etc.)
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      console.log('WebAuthn not supported: isUserVerifyingPlatformAuthenticatorAvailable not available');
      return false;
    }

    // Actually check if platform authenticator is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    console.log('Platform authenticator available:', available);
    
    return available;
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return false;
  }
}

/**
 * Register a new biometric credential (enrollment)
 * @param userId - User's unique ID
 * @param userName - User's name or email
 * @returns Credential data to store on server
 */
export async function registerBiometric(
  userId: string,
  userName: string
): Promise<BiometricCredential | null> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  console.log('WebAuthn baseUrl:', baseUrl);
  
  try {
    // Request registration options from server
    const optionsResponse = await fetch(`${baseUrl}/api/webauthn/register-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName }),
    });

    if (!optionsResponse.ok) {
      const errorText = await optionsResponse.text();
      console.error('Registration options error:', errorText);
      throw new Error(`Failed to get registration options: ${optionsResponse.status}`);
    }

    const optionsResult = await optionsResponse.json();
    const options = optionsResult.options;

    // Start registration with browser/OS
    const credential = await startRegistration(options);

    // Verify registration with server
    const verifyResponse = await fetch(`${baseUrl}/api/webauthn/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, credential }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify registration');
    }

    const verifyResult = await verifyResponse.json();
    return verifyResult.credential;
  } catch (error: any) {
    console.error('Biometric registration error:', error);
    
    // User-friendly error messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Biometric registration was cancelled or not allowed');
    } else if (error.name === 'InvalidStateError') {
      throw new Error('This device is already registered');
    } else {
      throw new Error(error.message || 'Failed to register biometric');
    }
  }
}

/**
 * Verify biometric authentication
 * @param userId - User's unique ID
 * @returns True if verification successful
 */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  try {
    // Request authentication options from server
    const optionsResponse = await fetch(`${baseUrl}/api/webauthn/auth-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!optionsResponse.ok) {
      throw new Error('Failed to get authentication options');
    }

    const options = await optionsResponse.json();

    // Start authentication with browser/OS
    const credential = await startAuthentication(options);

    // Verify authentication with server
    const verifyResponse = await fetch(`${baseUrl}/api/webauthn/auth-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, credential }),
    });

    if (!verifyResponse.ok) {
      return false;
    }

    const result = await verifyResponse.json();
    return result.verified === true;
  } catch (error: any) {
    console.error('Biometric verification error:', error);
    
    // User-friendly error messages
    if (error.name === 'NotAllowedError') {
      throw new Error('Biometric verification was cancelled');
    } else {
      throw new Error(error.message || 'Failed to verify biometric');
    }
  }
}

/**
 * Get user-friendly device name based on authenticator
 */
export function getDeviceTypeName(
  authenticatorAttachment?: string
): string {
  if (authenticatorAttachment === 'platform') {
    // Detect OS
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'Face ID / Touch ID';
    } else if (userAgent.includes('android')) {
      return 'Fingerprint';
    } else if (userAgent.includes('windows')) {
      return 'Windows Hello';
    } else if (userAgent.includes('mac')) {
      return 'Touch ID';
    }
    return 'Biometric Sensor';
  }
  return 'Security Key';
}
