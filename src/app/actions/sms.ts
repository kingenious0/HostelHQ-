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

/**
 * Notify admins when a new hostel is submitted for approval.
 * We call wait for the response from the API or call wigal directly.
 */
export async function notifyAdminsOfNewHostelSubmission(hostelName: string, submittedBy: string) {
    // Since this is a server action, we can just call the wigal library
    // But to stay consistent with existing logic, we'll use a message template
    const message = `🏠 HOSTELHQ: New hostel submission alert!\n\nHostel: ${hostelName}\nSubmitted by: ${submittedBy}\nAction required: Please review and approve/reject in admin dashboard.\n\nLogin: https://hostel-hq.vercel.app/admin/dashboard`;

    try {
        // We'll need to get admin phones. Usually better to do this in a lib,
        // but we can import from firebase here.
        const { db } = await import('@/lib/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'admin'));
        const querySnapshot = await getDocs(q);

        const phoneNumbers: string[] = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.phone) {
                phoneNumbers.push(userData.phone);
            }
        });

        if (phoneNumbers.length === 0) return { success: false, error: 'No admin phones found' };

        const results = await Promise.all(phoneNumbers.map(phone => wigalSendSMS(phone, message)));
        return { success: results.every(r => r.success) };
    } catch (error: any) {
        console.error('Error notifying admins:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Notify hostel creator about approval status.
 */
export async function notifyCreatorOfHostelStatus(
    hostelName: string,
    creatorPhone: string,
    status: 'approved' | 'rejected',
    reason?: string
) {
    const statusText = status === 'approved' ? '✅ APPROVED' : '❌ REJECTED';
    const actionText = status === 'approved' ? 'is now live on the platform' : 'was not approved';

    let message = `🏠 HOSTELHQ: Your hostel status update\n\nHostel: ${hostelName}\nStatus: ${statusText}\nYour hostel ${actionText}`;

    if (status === 'rejected' && reason) {
        message += `\n\nReason: ${reason}`;
    }

    if (status === 'approved') {
        message += `\n\nStudents can now book visits and secure rooms at your hostel!`;
    }

    try {
        return await wigalSendSMS(creatorPhone, message);
    } catch (error: any) {
        console.error('Error notifying creator:', error);
        return { success: false, error: error.message };
    }
}
