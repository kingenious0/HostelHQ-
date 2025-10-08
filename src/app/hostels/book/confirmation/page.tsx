
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
            router.push('/');
            return;
        }

        if (!hostelId || !reference || !visitType) {
             toast({ title: "Invalid Confirmation Link", description: "Missing booking details.", variant: "destructive" });
             router.push('/');
            return;
        }

        const createVisitRecord = async () => {
            try {
                if (visitType === 'agent') {
                    // This is the original flow for agent-assisted visits
                     if (!visitDate || !visitTime) {
                        toast({ title: "Invalid Confirmation Link", description: "Missing visit time for agent visit.", variant: "destructive" });
                        return;
                    }
                    const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        hostelId: hostelId,
                        agentId: null, 
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
                    // This is the new flow for self-visits
                    const hostelRef = doc(db, 'hostels', hostelId);
                    const hostelSnap = await getDoc(hostelRef);
                    if(!hostelSnap.exists()) throw new Error("Hostel not found");
                    const hostelData = hostelSnap.data() as Hostel;

                    toast({ title: "Payment Confirmed!", description: `Here are the directions to ${hostelData.name}.` });
                    // For self-visit, we just need to redirect them to a page showing the location.
                    // The tracking page is a good candidate as it already has the map centered on the hostel.
                    router.push(`/hostels/${hostelId}/book/tracking?self_visit=true`);

                } else {
                    throw new Error("Invalid visit type specified");
                }

            } catch (error) {
                console.error("Error creating visit record:", error);
                toast({ title: "Something went wrong", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                router.push(`/hostels/${hostelId}`);
            }
        };

        createVisitRecord();

    }, [router, hostelId, reference, currentUser, loadingAuth, toast, visitDate, visitTime, visitType]);

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

    