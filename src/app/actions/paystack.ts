
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
}

type HostelPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    hostelName: string;
    studentName: string;
}

export async function initializeMomoPayment(payload: MomoPaymentPayload) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    const callback_url = new URL(`${protocol}://${host}/hostels/book/confirmation`);
    callback_url.searchParams.set('hostelId', payload.hostelId);
    callback_url.searchParams.set('visitDate', payload.visitDate);
    callback_url.searchParams.set('visitTime', payload.visitTime);


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
                metadata: {
                    label: payload.label || 'HostelHQ Payment',
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

    } catch (error) {
        console.error("Error initializing Paystack transaction:", error);
        return { status: false, message: "Could not connect to payment service." };
    }
}


export async function initializeHostelPayment(payload: HostelPaymentPayload) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        console.error("Paystack secret key is not configured.");
        return { status: false, message: "Payment processor is not configured. Please contact support." };
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    const headersList = headers();
    const host = headersList.get('host') || 'localhost:9002';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // For securing a hostel, the confirmation can be a simple success page.
    const callback_url = `${protocol}://${host}/`;

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
                callback_url: callback_url,
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
