
// src/app/hostels/book/confirmation/page.tsx
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Hostel } from '@/lib/data';

function ConfirmationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const hostelId = searchParams.get('hostelId');
    const reference = searchParams.get('reference');
    const visitDate = searchParams.get('visitDate');
    const visitTime = searchParams.get('visitTime');
    const visitType = searchParams.get('visitType');
    const trxref = searchParams.get('trxref'); // For hostel securing

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (loadingAuth) return;

        if (!currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in to confirm a booking.", variant: "destructive" });
            router.push('/login');
            return;
        }

        const handleConfirmation = async () => {
            // This handles confirming payment for securing a hostel room
            if (trxref && hostelId) {
                try {
                    await addDoc(collection(db, 'bookings'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        paymentReference: trxref,
                        bookingDate: new Date().toISOString(),
                    });
                     toast({ title: "Room Secured!", description: "Congratulations! Your room is booked." });
                    // Redirect to a success page or dashboard
                    router.push('/');
                } catch (error) {
                    console.error("Error creating booking record:", error);
                    toast({ title: "Something went wrong", description: "Could not save your booking details. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }


            // This handles confirming payment for a visit
            if (!hostelId || !reference || !visitType) {
                 toast({ title: "Invalid Confirmation Link", description: "Missing booking details.", variant: "destructive" });
                 router.push('/');
                return;
            }

            try {
                let visitRef;
                if (visitType === 'agent') {
                    if (!visitDate || !visitTime) {
                        toast({ title: "Invalid Confirmation Link", description: "Missing visit time for agent visit.", variant: "destructive" });
                        return;
                    }
                    visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null, // Agent will be assigned on the tracking page
                        status: 'pending',
                        paymentReference: reference,
                        createdAt: new Date().toISOString(),
                        visitDate: visitDate,
                        visitTime: visitTime,
                        visitType: 'agent',
                        studentCompleted: false,
                    });
                    
                    toast({ title: "Payment Confirmed!", description: "We're finding an agent for you." });
                    router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`);

                } else if (visitType === 'self') {
                     // Log the self-visit in the database
                    visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null,
                        status: 'accepted', // Self-visits are auto-accepted as there is no agent
                        paymentReference: reference,
                        createdAt: new Date().toISOString(),
                        visitDate: new Date().toISOString(), // Self-visits are immediate
                        visitTime: new Date().toLocaleTimeString(),
                        visitType: 'self',
                        studentCompleted: false, // Student has not completed it yet
                    });

                    toast({ title: "Payment Confirmed!", description: "Proceed to the hostel using the directions provided." });
                    router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`);

                } else {
                    throw new Error("Invalid visit type specified");
                }

            } catch (error) {
                console.error("Error creating visit record:", error);
                toast({ title: "Something went wrong", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                router.push(`/hostels/${hostelId}`);
            }
        };

        handleConfirmation();

    }, [router, hostelId, reference, trxref, currentUser, loadingAuth, toast, visitDate, visitTime, visitType]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">Payment Confirmed. Processing Your Request...</h1>
            <p className="text-muted-foreground max-w-sm">
                Your payment was successful. Please wait while we finalize your booking details.
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
