
"use server";

import { PAYSTACK_PUBLIC_KEY } from "@/lib/paystack";
import { getPaystackKeys } from "@/lib/paystack-utils";
import { headers } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuth, getAuthenticatedUser } from "@/lib/auth-guard";
import { isHostelRestricted } from "@/lib/sanctions";

type MomoPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    phone: string;
    provider: 'mtn' | 'vod' | 'tgo';
    label?: string;
    hostelId: string;
    visitDate: string;
    visitTime?: string;
    visitType?: 'in_person' | 'self';
    studentName?: string; // For generating payment reference
}

type HostelPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    hostelName: string;
    studentName: string;
    hostelId: string;
    roomTypeId?: string;
    roomId?: string;
}

export async function initializeMomoPayment(payload: MomoPaymentPayload) {
    const { secretKey } = await getPaystackKeys();

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    // RBAC: Enforce student role
    const caller = await getAuthenticatedUser();
    if (caller && caller.role !== 'student') {
        return { status: false, message: "Forbidden: Only students can request visits." };
    }

    // Pre-flight sanction guardrail: Reject transactions for sanctioned properties
    if (payload.hostelId) {
        const hostelSnap = await adminDb.collection('hostels').doc(payload.hostelId).get();
        if (hostelSnap.exists) {
            const hData = hostelSnap.data();
            if (isHostelRestricted(hData)) {
                throw new Error("Action Denied: This property is sanctioned and cannot accept student bookings.");
            }
        }
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const callback_url = new URL(`${protocol}://${host}/hostels/book/confirmation`);
    callback_url.searchParams.set('hostelId', payload.hostelId);
    callback_url.searchParams.set('bookingType', 'secure');
    if (payload.visitDate) callback_url.searchParams.set('visitDate', payload.visitDate);
    if (payload.visitTime) callback_url.searchParams.set('visitTime', payload.visitTime);
    if (payload.visitType) callback_url.searchParams.set('visitType', payload.visitType);

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
    const { secretKey } = await getPaystackKeys();

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    // RBAC: Enforce student role
    const caller = await getAuthenticatedUser();
    if (caller && caller.role !== 'student') {
        return { status: false, message: "Forbidden: Only students can book hostels." };
    }

    // Pre-flight sanction & capacity guardrail: Prevent payment initialization for sanctioned or 100% full units
    if (payload.hostelId) {
        try {
            const hostelSnap = await adminDb.collection('hostels').doc(payload.hostelId).get();
            if (hostelSnap.exists) {
                const hData = hostelSnap.data();
                if (isHostelRestricted(hData)) {
                    throw new Error("Action Denied: This property is sanctioned and cannot accept student bookings.");
                }
                if (hData?.status === 'sold-out' || hData?.availability === 'Full') {
                    return { status: false, message: "Cannot initialize payment: This hostel has reached 100% capacity and is fully booked." };
                }
                if (payload.roomTypeId) {
                    const rtSnap = await adminDb.collection('hostels').doc(payload.hostelId).collection('roomTypes').doc(payload.roomTypeId).get();
                    if (rtSnap.exists) {
                        const rtData = rtSnap.data();
                        const capacity = Number(rtData?.capacity) || 1;
                        const numRooms = Number(rtData?.numberOfRooms) || 1;
                        const totalCap = Number(rtData?.totalCapacity) || (capacity * numRooms);
                        const occ = Number(rtData?.occupancy) || 0;
                        if (rtData?.status === 'sold-out' || rtData?.availability === 'Full' || (totalCap > 0 && occ >= totalCap)) {
                            return { status: false, message: "Cannot initialize payment: This room type has reached 100% capacity and is sold out." };
                        }
                    }
                }
            }
        } catch (checkErr: any) {
            if (checkErr?.message?.includes("Action Denied")) {
                throw checkErr;
            }
            console.warn("Capacity pre-check warning in initializeHostelPayment:", checkErr);
        }
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const callback_url = new URL(`${protocol}://${host}/hostels/book/confirmation`);
    callback_url.searchParams.set('hostelId', payload.hostelId);
    callback_url.searchParams.set('bookingType', 'secure');
    if (payload.roomTypeId) callback_url.searchParams.set('roomTypeId', payload.roomTypeId);
    if (payload.roomId) callback_url.searchParams.set('roomId', payload.roomId);

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
                    booking_type: 'secure',
                    student_id: (payload as any).studentId, // Ensure ID is passed for webhook processing
                    hostel_id: payload.hostelId,
                    room_type_id: payload.roomTypeId,
                    room_id: payload.roomId,
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

    } catch (error: any) {
        console.error("Error initializing Paystack transaction:", error);
        return { status: false, message: error?.message || "Could not connect to payment service." };
    }
}

/**
 * Verify Paystack Transaction and Process Booking (Securely on Server)
 * - Verifies transaction with Paystack
 * - Enforces capacity guardrails inside Firestore transaction
 * - Creates Booking record
 * - Updates Room Occupancy
 * - Credits Manager Wallet (Earnings Ledger)
 */
export async function verifyAndProcessBooking(reference: string, bookingData: any, hostelId: string, studentId: string) {
    const { secretKey } = await getPaystackKeys();
    if (!secretKey) return { success: false, message: "Server misconfiguration" };

    try {
        // 0. Enforce Server-Side Caller Authorization
        const caller = await requireAuth();
        if (caller.uid !== studentId && caller.role !== 'admin') {
            return { success: false, message: "Forbidden: You can only confirm bookings for your own account." };
        }

        // 1. Verify Transaction
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${secretKey}` }
        });
        const verifyData = await verifyResponse.json();

        if (!verifyData.status || verifyData.data.status !== 'success') {
            return { success: false, message: "Payment verification failed or transaction not successful." };
        }

        // Verify transaction metadata to ensure payment wasn't created for a different hostel
        const metadata = verifyData.data.metadata || {};
        if (metadata.hostel_id && metadata.hostel_id !== hostelId) {
            return { success: false, message: "Security error: Payment was not initialized for this hostel." };
        }
        if (metadata.student_id && metadata.student_id !== studentId && caller.role !== 'admin') {
            return { success: false, message: "Security error: Payment was initialized for a different student." };
        }

        const amountPaid = verifyData.data.amount; // In Pesewas
        if (!amountPaid || amountPaid <= 0) {
            return { success: false, message: "Invalid payment amount received." };
        }

        // 2. Check if booking already exists for this reference (Idempotency Check)
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

        // 4. Run Transaction (Capacity Guardrails + Booking + Occupancy + Wallet)
        await adminDb.runTransaction(async (t) => {
            // Transaction Prerequisite: All Reads MUST happen before any Writes

            // Read: Get Hostel Doc Manager ID (for wallet credit) & check hostel-level capacity
            const hostelRef = adminDb.collection('hostels').doc(hostelId);
            const hostelSnap = await t.get(hostelRef);
            if (!hostelSnap.exists) {
                throw new Error("Transaction rejected: Hostel record does not exist.");
            }
            const hostelData = hostelSnap.data();
            if (isHostelRestricted(hostelData)) {
                throw new Error("Action Denied: This property is sanctioned and cannot accept student bookings.");
            }
            if (hostelData?.status === 'sold-out' || hostelData?.availability === 'Full') {
                throw new Error("Transaction rejected: This hostel has reached 100% capacity and is fully booked.");
            }
            const managerId = hostelData?.managerId || null;

            // Read: Check RoomType existence & strict capacity limit
            let rtRef, rtSnap, rRef, rSnap;

            if (bookingData.roomTypeId) {
                rtRef = adminDb.collection('hostels').doc(hostelId).collection('roomTypes').doc(bookingData.roomTypeId);
                rtSnap = await t.get(rtRef);
                if (rtSnap && rtSnap.exists) {
                    const rtData = rtSnap.data();
                    const capacityPerRoom = Number(rtData?.capacity) || 1;
                    const numRooms = Number(rtData?.numberOfRooms) || 1;
                    const totalCap = Number(rtData?.totalCapacity) || (capacityPerRoom * numRooms);
                    const currentOcc = Number(rtData?.occupancy) || 0;

                    if (
                        rtData?.status === 'sold-out' ||
                        rtData?.availability === 'Full' ||
                        (totalCap > 0 && currentOcc >= totalCap)
                    ) {
                        throw new Error("Transaction rejected: This room type has reached 100% capacity and is sold out.");
                    }
                }
            }

            // Read: Check specific physical Room existence & capacity limit
            if (bookingData.roomId) {
                rRef = adminDb.collection('hostels').doc(hostelId).collection('rooms').doc(bookingData.roomId);
                rSnap = await t.get(rRef);
                if (rSnap && rSnap.exists) {
                    const rData = rSnap.data();
                    const roomCap = Number(rData?.capacity) || 1;
                    const roomOcc = Number(rData?.currentOccupancy) || 0;
                    if (
                        rData?.status === 'full' ||
                        rData?.status === 'sold-out' ||
                        roomOcc >= roomCap
                    ) {
                        throw new Error("Transaction rejected: This specific room unit has reached 100% capacity and is sold out.");
                    }
                }
            }

            // Locate target physical room and bed in hostelData.rooms array for atomic mutation
            let updatedRooms: any[] | null = null;
            if (Array.isArray(hostelData?.rooms) && hostelData.rooms.length > 0) {
                const rooms = [...hostelData.rooms];
                const roomIndex = rooms.findIndex((r: any) =>
                    (bookingData.roomId && r.id === bookingData.roomId) ||
                    (bookingData.roomNumber && (
                        r.roomNumber === bookingData.roomNumber ||
                        r.roomNumber === `Room ${bookingData.roomNumber}` ||
                        `room-${r.roomNumber}` === bookingData.roomNumber ||
                        r.id === bookingData.roomNumber
                    ))
                );

                if (roomIndex !== -1) {
                    const targetRoom = { ...rooms[roomIndex] };
                    const roomCap = Number(targetRoom.capacity || targetRoom.tierCapacity) || 1;

                    if (!Array.isArray(targetRoom.beds) || targetRoom.beds.length !== roomCap) {
                        targetRoom.beds = Array.from({ length: roomCap }, (_, i) => {
                            const existing = Array.isArray(targetRoom.beds) ? targetRoom.beds[i] : null;
                            return {
                                id: existing?.id || `bed-${i + 1}`,
                                isOccupied: Boolean(existing?.isOccupied),
                                studentId: existing?.studentId || null,
                                bookedAt: existing?.bookedAt || null,
                                bookingRef: existing?.bookingRef || null,
                            };
                        });
                    } else {
                        targetRoom.beds = targetRoom.beds.map((b: any) => ({ ...b }));
                    }

                    let bedIndex = -1;
                    if (bookingData.bedId) {
                        bedIndex = targetRoom.beds.findIndex((b: any) => b.id === bookingData.bedId);
                    }
                    if (bedIndex === -1) {
                        bedIndex = targetRoom.beds.findIndex((b: any) => !b.isOccupied);
                    }

                    if (bedIndex !== -1) {
                        targetRoom.beds[bedIndex] = {
                            ...targetRoom.beds[bedIndex],
                            isOccupied: true,
                            studentId,
                            bookedAt: new Date().toISOString(),
                            bookingRef: reference,
                        };
                        const remainingOpenBeds = targetRoom.beds.filter((b: any) => !b.isOccupied).length;
                        targetRoom.isFullyBooked = remainingOpenBeds === 0;
                        targetRoom.currentOccupancy = targetRoom.beds.filter((b: any) => b.isOccupied).length;
                        rooms[roomIndex] = targetRoom;
                        updatedRooms = rooms;
                    }
                }
            }

            // A. Create Booking (Write)
            t.set(bookingRef, bookingPayload);

            // B. Update Occupancy & Standardized Bed Mutation (Write)
            if (updatedRooms) {
                t.update(hostelRef, { rooms: updatedRooms });
            }
            if (rtRef && rtSnap && rtSnap.exists) {
                t.update(rtRef, { occupancy: FieldValue.increment(1) });
            }
            if (rRef && rSnap && rSnap.exists) {
                const rData = rSnap.data();
                const rCap = Number(rData?.capacity) || 1;
                let rBeds = Array.isArray(rData?.beds) && rData.beds.length === rCap
                    ? rData.beds.map((b: any) => ({ ...b }))
                    : Array.from({ length: rCap }, (_, i) => ({ id: `bed-${i + 1}`, isOccupied: false }));
                let bedIdx = bookingData.bedId ? rBeds.findIndex((b: any) => b.id === bookingData.bedId) : -1;
                if (bedIdx === -1) bedIdx = rBeds.findIndex((b: any) => !b.isOccupied);
                if (bedIdx !== -1) {
                    rBeds[bedIdx] = {
                        ...rBeds[bedIdx],
                        isOccupied: true,
                        studentId,
                        bookedAt: new Date().toISOString(),
                        bookingRef: reference,
                    };
                }
                t.update(rRef, {
                    currentOccupancy: FieldValue.increment(1),
                    beds: rBeds,
                    isFullyBooked: rBeds.every((b: any) => b.isOccupied),
                });
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

        // 5. Send Room Secured SMS to Manager & Student
        try {
            const { sendRoomSecuredSMSAction } = await import('@/app/actions/sms');
            await sendRoomSecuredSMSAction({
                bookingId: bookingRef.id,
                hostelId,
                studentId,
                studentName: bookingData?.studentName,
                studentPhone: bookingData?.phoneNumber,
                roomTypeName: bookingData?.roomTypeName,
                amountPaid,
                reference,
            });
        } catch (smsErr) {
            console.error("Error sending room secured SMS in verifyAndProcessBooking:", smsErr);
        }

        return { success: true, message: "Booking confirmed successfully", bookingId: bookingRef.id };

    } catch (error: any) {
        console.error("verifyAndProcessBooking Error:", error);
        return { success: false, message: error.message || "Failed to process booking." };
    }
}

