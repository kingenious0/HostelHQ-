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

function isValidPhone(phone?: string | null): boolean {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 14;
}

/**
 * Notify hostel manager and student via SMS when a visit is booked.
 */
export async function sendVisitBookingSMSAction(params: {
    visitId: string;
    hostelId: string;
    hostelName?: string;
    studentName: string;
    studentPhone: string;
    visitDate: string;
    visitTime: string;
    roomTypeName?: string;
}) {
    try {
        await requireAuth();

        const { adminDb, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin');
        const { db } = await import('@/lib/firebase');
        const { doc, getDoc, collection, addDoc } = await import('firebase/firestore');

        let hostelName = params.hostelName || '';
        let managerPhone = '';
        let managerId = '';

        // 1. Resolve Hostel Details
        if (isFirebaseAdminConfigured()) {
            const hSnap = await adminDb.collection('hostels').doc(params.hostelId).get();
            if (hSnap.exists) {
                const hData = hSnap.data() || {};
                hostelName = hostelName || hData.name || 'the hostel';
                managerPhone = hData.managerPhone || hData.contactPhone || '';
                managerId = hData.managerId || '';
            }
        } else {
            const hSnap = await getDoc(doc(db, 'hostels', params.hostelId));
            if (hSnap.exists()) {
                const hData = hSnap.data() || {};
                hostelName = hostelName || hData.name || 'the hostel';
                managerPhone = hData.managerPhone || hData.contactPhone || '';
                managerId = hData.managerId || '';
            }
        }

        // 2. If manager phone is missing on hostel, lookup user record of manager
        if (!managerPhone && managerId) {
            if (isFirebaseAdminConfigured()) {
                const mSnap = await adminDb.collection('users').doc(managerId).get();
                if (mSnap.exists) {
                    const mData = mSnap.data() || {};
                    managerPhone = mData.phone || mData.phoneNumber || '';
                }
            } else {
                const mSnap = await getDoc(doc(db, 'users', managerId));
                if (mSnap.exists()) {
                    const mData = mSnap.data() || {};
                    managerPhone = mData.phone || mData.phoneNumber || '';
                }
            }
        }

        const roomTypeStr = params.roomTypeName && params.roomTypeName !== 'General Inspection'
            ? params.roomTypeName
            : 'Hostel Tour';

        const contactForStudent = managerPhone || '+233597626090';

        const managerMessage = `🏠 HOSTELHQ: New Visit Request!\n\nHostel: ${hostelName}\nStudent: ${params.studentName} (${params.studentPhone})\nRoom: ${roomTypeStr}\nDate: ${params.visitDate} (${params.visitTime})\n\nPlease prepare for the student's inspection.\nLogin: https://hostel-hq.vercel.app/manager/dashboard`;

        const studentMessage = `🏠 HOSTELHQ: Visit Booked!\n\nYour inspection at ${hostelName} (${roomTypeStr}) is set for ${params.visitDate} (${params.visitTime}).\nHostel Contact: ${contactForStudent}\n\nView details: https://hostel-hq.vercel.app/my-bookings`;

        const results: { managerSms?: any; studentSms?: any } = {};

        // 3. Send SMS to Manager
        if (isValidPhone(managerPhone)) {
            console.log(`[SMS] Sending visit booking SMS to manager at ${managerPhone}`);
            results.managerSms = await wigalSendSMS(managerPhone, managerMessage);
            console.log('[SMS] Manager visit SMS result:', results.managerSms);
        } else {
            console.warn('[SMS] No valid manager phone found for hostel:', params.hostelId, managerPhone);
        }

        // 4. Send SMS to Student
        if (isValidPhone(params.studentPhone)) {
            console.log(`[SMS] Sending visit booking SMS to student at ${params.studentPhone}`);
            results.studentSms = await wigalSendSMS(params.studentPhone, studentMessage);
            console.log('[SMS] Student visit SMS result:', results.studentSms);
        } else {
            console.warn('[SMS] No valid student phone provided for visit:', params.visitId, params.studentPhone);
        }

        // 5. Log SMS Notification Event in Firestore
        try {
            const logEntry = {
                type: 'visit_booking',
                visitId: params.visitId,
                hostelId: params.hostelId,
                hostelName,
                managerPhone,
                studentPhone: params.studentPhone,
                managerResult: results.managerSms || null,
                studentResult: results.studentSms || null,
                createdAt: new Date().toISOString(),
            };

            if (isFirebaseAdminConfigured()) {
                await adminDb.collection('sms_notifications').add(logEntry);
            } else {
                await addDoc(collection(db, 'sms_notifications'), logEntry);
            }
        } catch (logErr) {
            console.warn('[SMS] Could not save SMS log to Firestore:', logErr);
        }

        return {
            success: true,
            managerSent: Boolean(results.managerSms?.success),
            studentSent: Boolean(results.studentSms?.success),
        };
    } catch (error: any) {
        console.error('Error in sendVisitBookingSMSAction:', error);
        return { success: false, error: error.message || 'Failed to send visit booking SMS' };
    }
}

/**
 * Notify hostel manager and student via SMS when a room is secured and payment verified.
 */
export async function sendRoomSecuredSMSAction(params: {
    bookingId: string;
    hostelId: string;
    studentId?: string;
    hostelName?: string;
    studentName?: string;
    studentPhone?: string;
    roomTypeName?: string;
    amountPaid: number; // in pesewas or GHS
    reference?: string;
}) {
    try {
        const { adminDb, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin');
        const { db } = await import('@/lib/firebase');
        const { doc, getDoc, collection, addDoc } = await import('firebase/firestore');

        let hostelName = params.hostelName || '';
        let managerPhone = '';
        let managerId = '';

        // 1. Resolve Hostel Details
        if (isFirebaseAdminConfigured()) {
            const hSnap = await adminDb.collection('hostels').doc(params.hostelId).get();
            if (hSnap.exists) {
                const hData = hSnap.data() || {};
                hostelName = hostelName || hData.name || 'the hostel';
                managerPhone = hData.managerPhone || hData.contactPhone || '';
                managerId = hData.managerId || '';
            }
        } else {
            const hSnap = await getDoc(doc(db, 'hostels', params.hostelId));
            if (hSnap.exists()) {
                const hData = hSnap.data() || {};
                hostelName = hostelName || hData.name || 'the hostel';
                managerPhone = hData.managerPhone || hData.contactPhone || '';
                managerId = hData.managerId || '';
            }
        }

        // 2. Lookup manager phone if missing
        if (!managerPhone && managerId) {
            if (isFirebaseAdminConfigured()) {
                const mSnap = await adminDb.collection('users').doc(managerId).get();
                if (mSnap.exists) {
                    const mData = mSnap.data() || {};
                    managerPhone = mData.phone || mData.phoneNumber || '';
                }
            } else {
                const mSnap = await getDoc(doc(db, 'users', managerId));
                if (mSnap.exists()) {
                    const mData = mSnap.data() || {};
                    managerPhone = mData.phone || mData.phoneNumber || '';
                }
            }
        }

        // 3. Resolve student phone if missing
        let studentPhone = params.studentPhone || '';
        let studentName = params.studentName || 'Student';

        if (!studentPhone && params.studentId) {
            if (isFirebaseAdminConfigured()) {
                const sSnap = await adminDb.collection('users').doc(params.studentId).get();
                if (sSnap.exists) {
                    const sData = sSnap.data() || {};
                    studentPhone = sData.phone || sData.phoneNumber || '';
                    studentName = studentName !== 'Student' ? studentName : (sData.fullName || sData.name || 'Student');
                }
            } else {
                const sSnap = await getDoc(doc(db, 'users', params.studentId));
                if (sSnap.exists()) {
                    const sData = sSnap.data() || {};
                    studentPhone = sData.phone || sData.phoneNumber || '';
                    studentName = studentName !== 'Student' ? studentName : (sData.fullName || sData.name || 'Student');
                }
            }
        }

        const contactForStudent = managerPhone || '+233597626090';
        const roomTypeStr = params.roomTypeName || 'Room';

        // Format GHS amount
        const ghsAmount = params.amountPaid >= 50000
            ? (params.amountPaid / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : params.amountPaid.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const shortRef = (params.bookingId || params.reference || 'REF').slice(-6).toUpperCase();

        const managerMessage = `🎉 HOSTELHQ: Room Secured!\n\nHostel: ${hostelName}\nStudent: ${studentName} (${studentPhone || 'N/A'})\nRoom: ${roomTypeStr}\nAmount: GHS ${ghsAmount}\nBooking Ref: #${shortRef}\n\nLogin to view tenancy: https://hostel-hq.vercel.app/manager/dashboard`;

        const studentMessage = `🎉 HOSTELHQ: Room Secured!\n\nCongratulations ${studentName}! Your room (${roomTypeStr}) at ${hostelName} is confirmed.\nAmount Paid: GHS ${ghsAmount}\nBooking Ref: #${shortRef}\nHostel Contact: ${contactForStudent}\n\nView invoice: https://hostel-hq.vercel.app/my-bookings`;

        const results: { managerSms?: any; studentSms?: any } = {};

        // 4. Send SMS to Manager
        if (isValidPhone(managerPhone)) {
            console.log(`[SMS] Sending room secured SMS to manager at ${managerPhone}`);
            results.managerSms = await wigalSendSMS(managerPhone, managerMessage);
            console.log('[SMS] Manager room secured SMS result:', results.managerSms);
        } else {
            console.warn('[SMS] No valid manager phone found for hostel:', params.hostelId, managerPhone);
        }

        // 5. Send SMS to Student
        if (isValidPhone(studentPhone)) {
            console.log(`[SMS] Sending room secured SMS to student at ${studentPhone}`);
            results.studentSms = await wigalSendSMS(studentPhone, studentMessage);
            console.log('[SMS] Student room secured SMS result:', results.studentSms);
        } else {
            console.warn('[SMS] No valid student phone provided for booking:', params.bookingId, studentPhone);
        }

        // 6. Log SMS Notification Event in Firestore
        try {
            const logEntry = {
                type: 'room_secured',
                bookingId: params.bookingId,
                hostelId: params.hostelId,
                hostelName,
                managerPhone,
                studentPhone,
                amountPaid: params.amountPaid,
                managerResult: results.managerSms || null,
                studentResult: results.studentSms || null,
                createdAt: new Date().toISOString(),
            };

            if (isFirebaseAdminConfigured()) {
                await adminDb.collection('sms_notifications').add(logEntry);
            } else {
                await addDoc(collection(db, 'sms_notifications'), logEntry);
            }
        } catch (logErr) {
            console.warn('[SMS] Could not save SMS log to Firestore:', logErr);
        }

        return {
            success: true,
            managerSent: Boolean(results.managerSms?.success),
            studentSent: Boolean(results.studentSms?.success),
        };
    } catch (error: any) {
        console.error('Error in sendRoomSecuredSMSAction:', error);
        return { success: false, error: error.message || 'Failed to send room secured SMS' };
    }
}
