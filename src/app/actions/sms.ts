'use server';

import { sendSMS as wigalSendSMS } from '@/lib/wigal';
import { requireAuth, requireRole, ACCREDITATION_AUTHORIZED_ROLES, normalizeRole } from '@/lib/auth-guard';

/**
 * Server Action to send an SMS via Wigal.
 * Secured: Requires authenticated session.
 */
export async function sendSMS(phoneNumber: string, message: string) {
    try {
        const caller = await requireAuth();
        const normalizedRole = normalizeRole(caller.role);
        if (normalizedRole !== 'admin' && normalizedRole !== 'coordinator' && normalizedRole !== 'dean') {
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
 * Notify Assigned Coordinators & Platform Admins when a new hostel is submitted for accreditation.
 * Event 1: New Submission
 * Template: [HostelHQ] New Property Filing: "{Hostel Name}" in {Location} submitted by {Manager Name}. Review pending on dashboard.
 */
export async function notifyNewHostelSubmissionSMSAction(params: {
    hostelName: string;
    location: string;
    managerName: string;
}) {
    try {
        await requireRole(['manager', 'admin', 'coordinator', 'dean']);
        const { hostelName, location, managerName } = params;
        const message = `[HostelHQ] New Property Filing: "${hostelName}" in ${location} submitted by ${managerName}. Review pending on dashboard.`;

        const { db } = await import('@/lib/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');

        const usersRef = collection(db, 'users');
        const [adminSnap, coordSnap, hostelCoordSnap] = await Promise.all([
            getDocs(query(usersRef, where('role', '==', 'admin'))),
            getDocs(query(usersRef, where('role', '==', 'coordinator'))),
            getDocs(query(usersRef, where('role', '==', 'hostel_coordinator'))),
        ]);

        const phoneNumbers = new Set<string>();
        const extractPhones = (snap: any) => {
            snap.forEach((doc: any) => {
                const data = doc.data();
                const phone = data.phone || data.phoneNumber;
                if (phone && isValidPhone(phone)) {
                    phoneNumbers.add(phone.trim());
                }
            });
        };

        extractPhones(adminSnap);
        extractPhones(coordSnap);
        extractPhones(hostelCoordSnap);

        if (phoneNumbers.size === 0) {
            console.warn('[SMS] No admin or coordinator phones found for new submission alert.');
            return { success: false, error: 'No admin or coordinator phones found' };
        }

        const results = await Promise.all(
            Array.from(phoneNumbers).map((phone) => wigalSendSMS(phone, message))
        );
        return { success: results.some((r) => r.success) };
    } catch (error: any) {
        console.error('Error in notifyNewHostelSubmissionSMSAction:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Backward compatible alias for admin/coordinator notification
 */
export async function notifyAdminsOfNewHostelSubmission(hostelName: string, submittedBy: string, location?: string) {
    return notifyNewHostelSubmissionSMSAction({
        hostelName,
        location: location || 'Campus Vicinity',
        managerName: submittedBy,
    });
}

/**
 * Notify hostel manager upon accreditation approval or rejection.
 * Event 2: Approval -> [HostelHQ] Congratulations! "{Hostel Name}" has been accredited and is now live for student bookings.
 * Event 3: Rejection -> [HostelHQ] Notice: Filing for "{Hostel Name}" was declined. Reason: {rejectionReason}. Visit your portal to rectify and re-submit.
 */
export async function notifyHostelAccreditationSMSAction(params: {
    hostelId?: string;
    hostelName: string;
    managerPhone?: string;
    managerId?: string;
    status: 'accredited' | 'declined' | 'approved' | 'rejected';
    rejectionReason?: string;
}) {
    try {
        await requireRole(ACCREDITATION_AUTHORIZED_ROLES);
        const { db } = await import('@/lib/firebase');
        const { doc, getDoc } = await import('firebase/firestore');

        let targetPhone = params.managerPhone || '';

        // Resolve phone from manager user profile if needed
        if (!targetPhone && params.managerId) {
            try {
                const userSnap = await getDoc(doc(db, 'users', params.managerId));
                if (userSnap.exists()) {
                    const uData = userSnap.data();
                    targetPhone = uData.phone || uData.phoneNumber || '';
                }
            } catch (uErr) {
                console.warn('Error fetching manager user phone for SMS:', uErr);
            }
        }

        // Resolve phone from hostel doc if still missing
        if (!targetPhone && params.hostelId) {
            try {
                const cleanId = params.hostelId.replace(/^HOSTEL#/i, '').replace(/^PENDING_HOSTEL#/i, '').trim();
                const hSnap = await getDoc(doc(db, 'hostels', cleanId));
                if (hSnap.exists()) {
                    const hData = hSnap.data();
                    targetPhone = hData.managerPhone || hData.contactPhone || hData.phone || '';
                    if (!targetPhone && hData.managerId) {
                        const userSnap = await getDoc(doc(db, 'users', hData.managerId));
                        if (userSnap.exists()) {
                            const uData = userSnap.data();
                            targetPhone = uData.phone || uData.phoneNumber || '';
                        }
                    }
                }
            } catch (hErr) {
                console.warn('Error fetching hostel record for manager phone:', hErr);
            }
        }

        if (!targetPhone || !isValidPhone(targetPhone)) {
            console.warn(`[SMS] No valid manager phone number found for hostel "${params.hostelName}"`);
            return { success: false, error: 'No valid manager phone number found' };
        }

        const isApproved = params.status === 'accredited' || params.status === 'approved';
        let message = '';

        if (isApproved) {
            // Event 2: Approval
            message = `[HostelHQ] Congratulations! "${params.hostelName}" has been accredited and is now live for student bookings.`;
        } else {
            // Event 3: Rejection / Remediation
            const reason = params.rejectionReason || 'Requirements not met';
            message = `[HostelHQ] Notice: Filing for "${params.hostelName}" was declined. Reason: ${reason}. Visit your portal to rectify and re-submit.`;
        }

        return await wigalSendSMS(targetPhone, message);
    } catch (error: any) {
        console.error('Error in notifyHostelAccreditationSMSAction:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Notify hostel creator about approval status (backward compatible wrapper).
 */
export async function notifyCreatorOfHostelStatus(
    hostelName: string,
    creatorPhone: string,
    status: 'approved' | 'rejected' | 'accredited' | 'declined',
    reason?: string
) {
    return notifyHostelAccreditationSMSAction({
        hostelName,
        managerPhone: creatorPhone,
        status: (status === 'approved' || status === 'accredited') ? 'accredited' : 'declined',
        rejectionReason: reason,
    });
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

/**
 * Dispatch SMS alert to property manager when a listing is suspended for exceeding statutory campus rent cap.
 */
export async function sendRentCapBreachSMSAction(params: {
    hostelId: string;
    hostelName: string;
    managerPhone?: string;
    roomTypeName: string;
    postedRate: number;
    statutoryCap: number;
}) {
    try {
        const caller = await requireRole(['coordinator', 'dean', 'admin']);
        const { db } = await import('@/lib/firebase');
        const { doc, getDoc, collection, addDoc } = await import('firebase/firestore');
        const { adminDb, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin');

        let managerPhone = params.managerPhone ? params.managerPhone.replace(/[^0-9]/g, '') : '';
        let managerId = '';

        // 1. Resolve Manager Phone if not directly supplied
        if (!managerPhone && params.hostelId) {
            const cleanId = params.hostelId.replace(/^HOSTEL#/i, '').replace(/^PENDING_HOSTEL#/i, '').trim();
            if (isFirebaseAdminConfigured()) {
                const hSnap = await adminDb.collection('hostels').doc(cleanId).get();
                if (hSnap.exists) {
                    const hData = hSnap.data() || {};
                    managerPhone = (hData.managerPhone || hData.contactPhone || '').replace(/[^0-9]/g, '');
                    managerId = hData.managerId || '';
                }
            } else {
                const hSnap = await getDoc(doc(db, 'hostels', cleanId));
                if (hSnap.exists()) {
                    const hData = hSnap.data() || {};
                    managerPhone = (hData.managerPhone || hData.contactPhone || '').replace(/[^0-9]/g, '');
                    managerId = hData.managerId || '';
                }
            }
        }

        if (!managerPhone && managerId) {
            try {
                const uSnap = await getDoc(doc(db, 'users', managerId));
                if (uSnap.exists()) {
                    const uData = uSnap.data() || {};
                    managerPhone = (uData.phone || uData.phoneNumber || '').replace(/[^0-9]/g, '');
                }
            } catch (uErr) {
                console.warn('[SMS] User phone lookup warning:', uErr);
            }
        }

        if (!managerPhone) {
            console.warn('[SMS] No verified manager phone found for hostel:', params.hostelName);
            return { success: false, error: 'No manager phone number found for listing' };
        }

        const message = `HOSTELHQ NOTICE: Your ${params.roomTypeName} rate of GH₵${params.postedRate.toLocaleString()} at "${params.hostelName}" exceeds the statutory campus rent cap of GH₵${params.statutoryCap.toLocaleString()}. Listing suspended from student view. Lower your tariff to restore visibility: https://hostel-hq.vercel.app/manager/dashboard`;

        const smsRes = await wigalSendSMS(managerPhone, message);

        // Log SMS Notification Event
        try {
            const logEntry = {
                type: 'rent_cap_breach',
                hostelId: params.hostelId,
                hostelName: params.hostelName,
                managerPhone,
                roomTypeName: params.roomTypeName,
                postedRate: params.postedRate,
                statutoryCap: params.statutoryCap,
                result: smsRes,
                dispatchedBy: caller.fullName || caller.displayName || caller.uid,
                createdAt: new Date().toISOString(),
            };

            if (isFirebaseAdminConfigured()) {
                await adminDb.collection('sms_notifications').add(logEntry);
            } else {
                await addDoc(collection(db, 'sms_notifications'), logEntry);
            }
        } catch (logErr) {
            console.warn('[SMS] Could not save rent cap SMS log to Firestore:', logErr);
        }

        return {
            success: Boolean(smsRes.success),
            smsResult: smsRes,
        };
    } catch (error: any) {
        console.error('Error in sendRentCapBreachSMSAction:', error);
        return { success: false, error: error.message || 'Failed to dispatch rent cap breach SMS' };
    }
}

