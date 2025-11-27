
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
    callback_url.searchParams.set('bookingType', 'secure');    callback_url.searchParams.set('visitDate', payload.visitDate);
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
