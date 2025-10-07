
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
    const reference = searchParams.get('reference');

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

        if (!hostelId || !reference) {
             toast({ title: "Invalid Confirmation Link", description: "Missing booking details.", variant: "destructive" });
             router.push('/');
            return;
        }

        const createVisitRecord = async () => {
            try {
                // This is where we create the visit record in Firestore
                const visitRef = await addDoc(collection(db, 'visits'), {
                    studentId: currentUser.uid,
                    hostelId: hostelId,
                    agentId: null, // Agent will be assigned later
                    status: 'pending', // Initial status after payment
                    paymentReference: reference,
                    createdAt: new Date().toISOString(),
                });
                
                toast({ title: "Visit confirmed!", description: "We're finding an agent for you." });
                
                // Redirect to the tracking page, passing the new visit ID
                router.push(`/hostels/${hostelId}/book/tracking?visitId=${visitRef.id}`);

            } catch (error) {
                console.error("Error creating visit record:", error);
                toast({ title: "Something went wrong", description: "Could not save your visit details. Please contact support.", variant: 'destructive'});
                router.push(`/hostels/${hostelId}`);
            }
        };

        createVisitRecord();

    }, [router, hostelId, reference, currentUser, loadingAuth, toast]);

    return (
        <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">Payment Confirmed. Saving Your Visit...</h1>
            <p className="text-muted-foreground max-w-sm">
                Your payment was successful. Please wait while we create your visit record and find an agent.
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
