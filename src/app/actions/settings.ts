
"use server";

import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export type PaystackSettings = {
    mode: 'test' | 'live';
    testPublicKey: string;
    testSecretKey: string;
    livePublicKey: string;
    liveSecretKey: string;
}

export async function getPaystackSettings(): Promise<PaystackSettings | null> {
    try {
        const doc = await adminDb.collection('system_settings').doc('paystack').get();
        if (doc.exists) {
            return doc.data() as PaystackSettings;
        }
        return null;
    } catch (error) {
        console.error("Error fetching paystack settings:", error);
        return null;
    }
}

export async function updatePaystackSettings(settings: PaystackSettings) {
    try {
        await adminDb.collection('system_settings').doc('paystack').set({
            ...settings,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        revalidatePath('/admin/settings');
        return { success: true };
    } catch (error) {
        console.error("Error updating paystack settings:", error);
        return { success: false, error: "Failed to update settings" };
    }
}

export async function getPublicPaystackConfig() {
    try {
        const doc = await adminDb.collection('system_settings').doc('paystack').get();
        if (doc.exists) {
            const data = doc.data() as PaystackSettings;
            const mode = data.mode || 'test';
            return {
                publicKey: mode === 'live' ? data.livePublicKey : data.testPublicKey,
                mode: mode
            };
        }
    } catch (error) {
        console.error("Error fetching public paystack config:", error);
    }

    return {
        publicKey: process.env.PAYSTACK_PUBLIC_KEY,
        mode: 'test'
    };
}
