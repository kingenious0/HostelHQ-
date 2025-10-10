
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
        if (loadingAuth || hasProcessed) {
            return;
        }
        
        if (!currentUser) {
            if(!loadingAuth) {
                 toast({ title: "Authentication Error", description: "You must be logged in to confirm a booking.", variant: 'destructive'});
                 router.push('/login');
            }
            return;
        }

        const handleConfirmation = async () => {
            setHasProcessed(true); // Mark as processed immediately

            // This handles confirming payment for securing a hostel room
            if (trxref && hostelId) {
                toast({ title: "Confirming Room Booking...", description: "Please wait while we finalize your details." });
                try {
                    await addDoc(collection(db, 'bookings'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        paymentReference: trxref,
                        bookingDate: new Date().toISOString(),
                        status: 'confirmed'
                    });
                     toast({ title: "Room Secured!", description: "Congratulations! Your room is booked and your agent will be in touch." });
                    router.push(`/hostels/${hostelId}`); // Redirect to hostel page after securing
                } catch (error) {
                    console.error("Error creating booking record:", error);
                    toast({ title: "Something went wrong", description: "Could not save your booking details. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // This handles confirming payment for a visit
            if (reference && hostelId && visitType) {
                 toast({ title: "Payment Confirmed!", description: "Finalizing your visit details..." });
                 try {
                     const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null,
                        status: visitType === 'self' ? 'accepted' : 'pending',
                        paymentReference: reference,
                        createdAt: new Date().toISOString(),
                        visitDate: visitDate || new Date().toISOString(),
                        visitTime: visitTime || new Date().toLocaleTimeString(),
                        visitType: visitType,
                        studentCompleted: false,
                    });
                    
                    // Redirect to the tracking page with the new visit ID
                    router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`);

                } catch (error) {
                    console.error("Error creating visit record:", error);
                    toast({ title: "Something went wrong", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // If no valid parameters are found, wait briefly before concluding it's an error
            setTimeout(() => {
                if (!hasProcessed) {
                    toast({ title: "Invalid Confirmation Link", description: "Missing required booking details.", variant: "destructive" });
                    router.push('/');
                }
            }, 1000);

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
