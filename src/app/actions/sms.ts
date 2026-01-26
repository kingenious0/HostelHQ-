'use server';

import { sendSMS as wigalSendSMS } from '@/lib/wigal';

/**
 * Server Action to send an SMS via Wigal.
 * This keeps the Node.js modules (dns, etc.) on the server side.
 */
export async function sendSMS(phoneNumber: string, message: string) {
    try {
        return await wigalSendSMS(phoneNumber, message);
    } catch (error: any) {
        console.error('Error in sendSMS server action:', error);
        return {
            success: false,
            error: error.message || 'Failed to send SMS'
        };
    }
}
