
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MyBookingsAndVisitsPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the new enhanced My Bookings page
        router.replace('/my-bookings');
    }, [router]);

    return null;
}
