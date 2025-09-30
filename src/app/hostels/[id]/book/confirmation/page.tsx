// src/app/hostels/[id]/book/confirmation/page.tsx
"use client";

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { id } = use(params);

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push(`/hostels/${id}/book/tracking`);
        }, 3000); // Simulate a delay for finding an agent

        return () => clearTimeout(timer);
    }, [router, id]);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <div className="flex flex-col items-center justify-center text-center">
                    <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
                    <h1 className="text-2xl font-bold font-headline mb-2">Finding a Nearby Agent</h1>
                    <p className="text-muted-foreground max-w-sm">
                        Please wait while we match you with an available agent to guide your visit. This should only take a moment.
                    </p>
                </div>
            </main>
        </div>
    );
}
