
import { adminDb } from "./firebase-admin";

export async function getPaystackKeys() {
    // Try to get from Firestore first
    try {
        const doc = await adminDb.collection('system_settings').doc('paystack').get();
        if (doc.exists) {
            const data = doc.data();
            const mode = data?.mode || 'test';

            if (mode === 'live') {
                return {
                    publicKey: data?.livePublicKey || process.env.PAYSTACK_PUBLIC_KEY,
                    secretKey: data?.liveSecretKey || process.env.PAYSTACK_SECRET_KEY,
                    mode: 'live' as const
                };
            } else {
                return {
                    publicKey: data?.testPublicKey || process.env.PAYSTACK_PUBLIC_KEY,
                    secretKey: data?.testSecretKey || process.env.PAYSTACK_SECRET_KEY,
                    mode: 'test' as const
                };
            }
        }
    } catch (error) {
        console.error("Error fetching Paystack keys from Firestore:", error);
    }

    // Fallback to environment variables
    return {
        publicKey: process.env.PAYSTACK_PUBLIC_KEY,
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        mode: 'test' as const // Assume test if not specified
    };
}

import crypto from "crypto";

/**
 * Generate a tamper-proof verification hash for a Paystack-resolved account
 */
export function generatePaystackVerificationToken(
    accountNumber: string,
    bankCode: string,
    accountName: string,
    secretKey?: string
): string {
    const key = secretKey || process.env.PAYSTACK_SECRET_KEY || "hostelhq-payout-verification-secret";
    return crypto
        .createHmac("sha256", key)
        .update(`${accountNumber.trim()}:${bankCode.trim()}:${accountName.trim().toUpperCase()}`)
        .digest("hex");
}

/**
 * Verify a Paystack verification hash against provided account parameters
 */
export function verifyPaystackToken(
    accountNumber: string,
    bankCode: string,
    accountName: string,
    token: string,
    secretKey?: string
): boolean {
    if (!token || !accountNumber || !bankCode || !accountName) return false;
    const expected = generatePaystackVerificationToken(accountNumber, bankCode, accountName, secretKey);
    try {
        const tokenBuf = Buffer.from(token);
        const expectedBuf = Buffer.from(expected);
        if (tokenBuf.length !== expectedBuf.length) return false;
        return crypto.timingSafeEqual(tokenBuf, expectedBuf);
    } catch {
        return false;
    }
}

