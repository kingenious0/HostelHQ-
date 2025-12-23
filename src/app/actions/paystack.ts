
"use server";

import { PAYSTACK_PUBLIC_KEY } from "@/lib/paystack";
import { headers } from "next/headers";

type MomoPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    phone: string;
    provider: 'mtn' | 'vod' | 'tgo';
    label?: string;
    hostelId: string;
    visitDate: string;
    visitTime: string;
    visitType: 'agent' | 'self';
    studentName?: string; // For generating payment reference
}

type HostelPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    hostelName: string;
    studentName: string;
    hostelId: string;
}

export async function initializeMomoPayment(payload: MomoPaymentPayload) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const callback_url = new URL(`${protocol}://${host}/hostels/book/confirmation`);
    callback_url.searchParams.set('hostelId', payload.hostelId);
    callback_url.searchParams.set('bookingType', 'secure'); callback_url.searchParams.set('visitDate', payload.visitDate);
    callback_url.searchParams.set('visitTime', payload.visitTime);
    callback_url.searchParams.set('visitType', payload.visitType);

    // Generate professional payment reference: VISIT-{first3letters}{last3digits}
    const generatePaymentReference = () => {
        const name = payload.studentName || 'Student';
        const phone = payload.phone || '';

        // Extract first 3 letters of name (remove spaces, capitalize first letter)
        const nameNoSpaces = name.replace(/\s+/g, '');
        const namePart = nameNoSpaces.length >= 3
            ? nameNoSpaces.substring(0, 3).charAt(0).toUpperCase() + nameNoSpaces.substring(1, 3).toLowerCase()
            : (nameNoSpaces.charAt(0).toUpperCase() + nameNoSpaces.substring(1).toLowerCase()).padEnd(3, 'x');

        // Extract last 3 digits of phone (remove all non-digits first)
        const digitsOnly = phone.replace(/\D/g, '');
        const phonePart = digitsOnly.length >= 3
            ? digitsOnly.slice(-3)
            : digitsOnly.padStart(3, '0');

        // Add timestamp to ensure uniqueness
        const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
        return `VISIT-${namePart}${phonePart}-${timestamp}`;
    };

    const paymentReference = generatePaymentReference();


    try {
        const response = await fetch(paystackUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: payload.email,
                amount: payload.amount,
                currency: 'GHS',
                reference: paymentReference,
                callback_url: callback_url.toString(),
                metadata: {
                    label: payload.label || 'HostelHQ Payment',
                    visitType: payload.visitType,
                    booking_type: 'visit',
                    student_name: payload.studentName || 'N/A'
                },
                channels: ['mobile_money'],
                mobile_money: {
                    phone: payload.phone,
                    provider: payload.provider,
                }
            }),
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            console.error('Paystack API Error:', result);
            throw new Error(result.message || "An error occurred with the payment provider.");
        }

        return {
            status: true,
            authorization_url: result.data.authorization_url,
            reference: result.data.reference,
        };

    } catch (error: any) {
        console.error("Error initializing Paystack transaction:", error);
        console.error("Error details:", {
            name: error?.name,
            message: error?.message,
            cause: error?.cause,
        });
        return { status: false, message: `Could not connect to payment service. ${error?.message || ''}` };
    }
}


export async function initializeHostelPayment(payload: HostelPaymentPayload) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const callback_url = new URL(`${protocol}://${host}/hostels/book/confirmation`);
    callback_url.searchParams.set('hostelId', payload.hostelId);
    callback_url.searchParams.set('bookingType', 'secure');

    try {
        const response = await fetch(paystackUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: payload.email,
                amount: payload.amount,
                currency: 'GHS',
                callback_url: callback_url.toString(),
                reference: `SECURE_${Date.now()}`, // Generate a reference for secure hostel booking
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Student Name",
                            variable_name: "student_name",
                            value: payload.studentName
                        },
                        {
                            display_name: "Hostel Name",
                            variable_name: "hostel_name",
                            value: payload.hostelName
                        },
                        {
                            display_name: "Booking Type",
                            variable_name: "booking_type",
                            value: "secure"
                        }
                    ]
                }
            }),
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            console.error('Paystack API Error:', result);
            throw new Error(result.message || "An error occurred with the payment provider.");
        }

        return {
            status: true,
            authorization_url: result.data.authorization_url,
        };

    } catch (error) {
        console.error("Error initializing Paystack transaction:", error);
        return { status: false, message: "Could not connect to payment service." };
    }
}

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Verify Paystack Transaction and Process Booking (Securely on Server)
 * - Verifies transaction with Paystack
 * - Creates Booking record
 * - Updates Room Occupancy
 * - Credits Manager Wallet (Earnings Ledger)
 */
export async function verifyAndProcessBooking(reference: string, bookingData: any, hostelId: string, studentId: string) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return { success: false, message: "Server misconfiguration" };

    try {
        // 1. Verify Transaction
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${secretKey}` }
        });
        const verifyData = await verifyResponse.json();

        if (!verifyData.status || verifyData.data.status !== 'success') {
            return { success: false, message: "Payment verification failed." };
        }

        const amountPaid = verifyData.data.amount; // In Pesewas

        // 2. Check if booking already exists for this reference
        const bookingQuery = await adminDb.collection('bookings')
            .where('paymentReference', '==', reference)
            .get();

        if (!bookingQuery.empty) {
            return { success: true, message: "Booking already processed.", bookingId: bookingQuery.docs[0].id };
        }

        // 3. Create Booking Record
        const bookingRef = adminDb.collection('bookings').doc();
        const bookingPayload = {
            studentId,
            studentDetails: {
                fullName: bookingData.studentName || '',
                email: bookingData.email || '',
                phoneNumber: bookingData.phoneNumber || '',
                indexNumber: bookingData.indexNumber || '',
                ghanaCardNumber: bookingData.ghanaCardNumber || '',
                program: bookingData.departmentName || '',
                level: bookingData.level || '',
                guardianEmail: bookingData.guardianEmail || '',
            },
            hostelId,
            roomTypeId: bookingData.roomTypeId || '',
            roomId: bookingData.roomId || '',
            roomNumber: bookingData.roomNumber || '',
            paymentReference: reference,
            amountPaid: amountPaid, // Pesewas
            bookingDate: FieldValue.serverTimestamp(),
            status: 'confirmed',
            invoiceGenerated: false,
        };

        // 4. Run Transaction (Booking + Occupancy + Wallet)
        await adminDb.runTransaction(async (t) => {
            // Transaction Prerequisite: All Reads MUST happen before any Writes

            // Read: Get Hostel Doc Manager ID (for wallet credit)
            const hostelRef = adminDb.collection('hostels').doc(hostelId);
            const hostelSnap = await t.get(hostelRef);
            const managerId = hostelSnap.exists ? hostelSnap.data()?.managerId : null;

            // Read: Check RoomType and Room existence
            let rtRef, rtSnap, rRef, rSnap;

            if (bookingData.roomTypeId) {
                rtRef = adminDb.collection('hostels').doc(hostelId).collection('roomTypes').doc(bookingData.roomTypeId);
                rtSnap = await t.get(rtRef);
            }
            if (bookingData.roomId) {
                rRef = adminDb.collection('hostels').doc(hostelId).collection('rooms').doc(bookingData.roomId);
                rSnap = await t.get(rRef);
            }

            // A. Create Booking (Write)
            t.set(bookingRef, bookingPayload);

            // B. Update Occupancy (Write)
            if (rtRef && rtSnap && rtSnap.exists) {
                t.update(rtRef, { occupancy: FieldValue.increment(1) });
            }
            if (rRef && rSnap && rSnap.exists) {
                t.update(rRef, { currentOccupancy: FieldValue.increment(1) });
            }

            // C. Update Manager Wallet (Earnings Ledger) (Write)
            if (managerId) {
                const managerRef = adminDb.collection('users').doc(managerId);
                // Credit the FULL amount paid for now. (Or apply commission logic here if needed)
                t.update(managerRef, {
                    walletBalance: FieldValue.increment(amountPaid)
                });
            }
        });

        return { success: true, message: "Booking confirmed successfully", bookingId: bookingRef.id };

    } catch (error: any) {
        console.error("verifyAndProcessBooking Error:", error);
        return { success: false, message: error.message || "Failed to process booking." };
    }
}

