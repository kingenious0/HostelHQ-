// src/app/hostels/book/confirmation/page.tsx
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

function ConfirmationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const hostelId = searchParams.get('hostelId');
    const reference = searchParams.get('reference'); // For visit payments
    const trxref = searchParams.get('trxref'); // For room security payments
    const visitDate = searchParams.get('visitDate');
    const visitTime = searchParams.get('visitTime');
    const visitType = searchParams.get('visitType');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [hasProcessed, setHasProcessed] = useState(false); // State to prevent double-processing

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (loadingAuth || hasProcessed || !currentUser) {
            return;
        }

        const handleConfirmation = async () => {
            setHasProcessed(true); // Mark as processed immediately

            // Check for room security payment confirmation (trxref)
            if (trxref && hostelId) {
                try {
                    // 1. Create the primary booking record (Room Secured)
                    await addDoc(collection(db, 'bookings'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        paymentReference: trxref,
                        bookingDate: new Date().toISOString(),
                        status: 'paid' // New status: Paid, awaiting visit
                    });

                    // 2. Create the initial visit record (Visit Scheduled)
                    const initialVisitDate = new Date().toISOString(); 
                    const initialVisitTime = new Date().toLocaleTimeString();

                    const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null, // Will be set later
                        status: 'scheduling', // New status: Student needs to schedule
                        paymentReference: trxref,
                        createdAt: new Date().toISOString(),
                        visitDate: initialVisitDate,
                        visitTime: initialVisitTime,
                        visitType: 'agent', // Assuming room security requires an agent-assisted visit
                        studentCompleted: false,
                    });

                    // 3. Redirect to the new Scheduling page with the Visit ID
                    router.push(`/hostels/book/schedule?visitId=${visitRef.id}`);

                } catch (error) {
                    console.error("Error creating booking/visit record:", error);
                    toast({ title: "Booking Error", description: "Could not finalize your booking. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // Check for visit-only payment confirmation (reference)
            if (reference && hostelId && visitType) {
                try {
                     // 1. Create the visit record
                     const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null,
                        status: 'scheduling', 
                        paymentReference: reference,
                        createdAt: new Date().toISOString(),
                        visitDate: visitDate || new Date().toISOString(),
                        visitTime: visitTime || new Date().toLocaleTimeString(),
                        visitType: visitType as 'agent' | 'self',
                        studentCompleted: false,
                    });
                    
                    // 2. Redirect to the new Scheduling page with the Visit ID or tracking page for self-visits
                    if (visitType === 'self') {
                        router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`);
                    } else {
                        router.push(`/hostels/book/schedule?visitId=${visitRef.id}`);
                    }

                } catch (error) {
                    console.error("Error creating visit record:", error);
                    toast({ title: "Visit Error", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // Fallback if no valid parameters are found
            toast({ title: "Invalid Confirmation Link", description: "Missing required booking details.", variant: "destructive" });
            router.push('/');
        };

        handleConfirmation();

    }, [currentUser, loadingAuth, hasProcessed, router, hostelId, reference, trxref, toast, visitDate, visitTime, visitType]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">Processing Your Request...</h1>
            <p className="text-muted-foreground max-w-sm">
                Please wait while we finalize your booking details. You will be redirected shortly.
            </p>
        </div>
    );
}


export default function BookingConfirmationPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <Suspense fallback={
                    <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
                        <h1 className="text-2xl font-bold font-headline mb-2">Loading Confirmation...</h1>
                    </div>
                }>
                    <ConfirmationContent />
                </Suspense>
            </main>
        </div>
    );
}
