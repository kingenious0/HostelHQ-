// src/app/hostels/book/confirmation/page.tsx
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
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
    const visitTypeParam = searchParams.get('visitType');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [hasProcessed, setHasProcessed] = useState(false);

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
            setHasProcessed(true);

            if (!hostelId || (!trxref && !reference)) {
                toast({ title: "Invalid Confirmation Link", description: "Missing required booking details.", variant: "destructive" });
                router.push('/');
                return;
            }
            
            // This is a room security payment
            if (trxref && hostelId) {
                try {
                     const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                     if(!userDoc.exists()) throw new Error("Student user record not found.");

                    const bookingRef = await addDoc(collection(db, 'bookings'), {
                        studentId: currentUser.uid,
                        studentDetails: userDoc.data(), // Store a snapshot of user details
                        hostelId: hostelId,
                        paymentReference: trxref,
                        bookingDate: serverTimestamp(),
                        status: 'confirmed',
                        roomNumber: 'Not Assigned',
                        roomType: 'Standard'
                    });

                    toast({
                        title: "Room Secured!",
                        description: "Your payment was successful. Generating your tenancy agreement...",
                    });
                     router.push(`/agreement/${bookingRef.id}`);

                } catch (error) {
                    console.error("Error creating booking record:", error);
                    toast({ title: "Booking Error", description: "Could not finalize your booking. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // This is a visit-only payment
            if (reference && hostelId && visitTypeParam) {
                try {
                     const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null,
                        status: visitTypeParam === 'self' ? 'accepted' : 'scheduling',
                        paymentReference: reference,
                        createdAt: serverTimestamp(),
                        visitDate: visitDate || new Date().toISOString(),
                        visitTime: visitTime || new Date().toLocaleTimeString(),
                        visitType: visitTypeParam as 'agent' | 'self',
                        studentCompleted: false,
                    });
                    
                    const redirectUrl = visitTypeParam === 'self'
                        ? `/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`
                        : `/hostels/book/schedule?visitId=${visitRef.id}`;
                    
                    router.push(redirectUrl);

                } catch (error) {
                    console.error("Error creating visit record:", error);
                    toast({ title: "Visit Error", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                    router.push(`/hostels/${hostelId}`);
                }
                return;
            }

            // Fallback if no valid parameters are found after the initial check
            toast({ title: "Invalid Confirmation Link", description: "The confirmation link is incomplete.", variant: "destructive" });
            router.push('/');
        };

        handleConfirmation();

    }, [currentUser, loadingAuth, hasProcessed, router, hostelId, reference, trxref, toast, visitDate, visitTime, visitTypeParam]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">Finalizing Your Request...</h1>
            <p className="text-muted-foreground max-w-sm">
                Your payment was successful. Please wait while we create your booking details. You will be redirected shortly.
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
