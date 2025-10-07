
"use server";

import { PAYSTACK_PUBLIC_KEY } from "@/lib/paystack";
import { headers } from "next/headers";

type MomoPaymentPayload = {
    email: string;
    amount: number; // in pesewas
    phone: string;
    provider: 'mtn' | 'vod' | 'tgo';
    label?: string;
    hostelId: string; // Added hostelId
}

export async function initializeMomoPayment(payload: MomoPaymentPayload) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
        throw new Error("Paystack secret key is not configured.");
    }

    const paystackUrl = 'https://api.paystack.co/transaction/initialize';

    // Get the base URL for the callback
    const headersList = headers();
    const host = headersList.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // Use a static, absolute URL for reliability
    const callback_url = `${protocol}://${host}/hostels/book/confirmation?hostelId=${payload.hostelId}`;


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
                callback_url, // URL to redirect to after payment
                metadata: {
                    label: payload.label || 'HostelHQ Payment',
                    // In the future, we can add split_code here
                },
                channels: ['mobile_money'],
                mobile_money: {
                    phone: payload.phone,
                    provider: payload.provider,
                }
            })
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
