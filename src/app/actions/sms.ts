'use server';

import { sendSMS as wigalSendSMS } from '@/lib/wigal';
import { requireAuth, requireRole } from '@/lib/auth-guard';

/**
 * Server Action to send an SMS via Wigal.
 * Secured: Requires authenticated session.
 */
export async function sendSMS(phoneNumber: string, message: string) {
    try {
        const caller = await requireAuth();
        if (caller.role !== 'admin') {
            const callerPhone = caller.phone ? caller.phone.replace(/[^0-9]/g, '') : '';
            const destPhone = phoneNumber.replace(/[^0-9]/g, '');
            if (callerPhone && !destPhone.endsWith(callerPhone.slice(-9))) {
                throw new Error('Unauthorized: You can only dispatch notifications to your verified phone number.');
            }
        }
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
    try {
        await requireRole(['manager', 'admin']);
        const message = `🏠 HOSTELHQ: New hostel submission alert!\n\nHostel: ${hostelName}\nSubmitted by: ${submittedBy}\nAction required: Please review and approve/reject in admin dashboard.\n\nLogin: https://hostel-hq.vercel.app/admin/dashboard`;

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
    try {
        await requireRole(['admin', 'dean', 'coordinator']);
        const statusText = status === 'approved' ? '✅ APPROVED' : '❌ REJECTED';
        const actionText = status === 'approved' ? 'is now live on the platform' : 'was not approved';

        let message = `🏠 HOSTELHQ: Your hostel status update\n\nHostel: ${hostelName}\nStatus: ${statusText}\nYour hostel ${actionText}`;

        if (status === 'rejected' && reason) {
            message += `\n\nReason: ${reason}`;
        }

        if (status === 'approved') {
            message += `\n\nStudents can now book visits and secure rooms at your hostel!`;
        }

        return await wigalSendSMS(creatorPhone, message);
    } catch (error: any) {
        console.error('Error notifying creator:', error);
        return { success: false, error: error.message };
    }
}
