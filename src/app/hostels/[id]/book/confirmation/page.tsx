
// src/app/hostels/[id]/book/confirmation/page.tsx
"use client";

import { useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';

export default function BookingConfirmationPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { id } = params;

    // Paystack provides a 'reference' in the query params after successful payment.
    const reference = searchParams.get('reference');

    useEffect(() => {
        // We can use the reference to verify the transaction on the backend in a real app.
        // For now, we'll just simulate a delay and redirect.
        console.log("Payment reference:", reference);

        const timer = setTimeout(() => {
            if (id) {
                router.push(`/hostels/${id}/book/tracking`);
            }
        }, 3000); // Simulate a delay for finding an agent

        return () => clearTimeout(timer);
    }, [router, id, reference]);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <div className="flex flex-col items-center justify-center text-center">
                    <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
                    <h1 className="text-2xl font-bold font-headline mb-2">Payment Confirmed. Finding Agent...</h1>
                    <p className="text-muted-foreground max-w-sm">
                        Your payment was successful. Please wait while we match you with an available agent to guide your visit.
                    </p>
                </div>
            </main>
        </div>
    );
}
