
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
