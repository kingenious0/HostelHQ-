
// src/app/hostels/[id]/book/confirmation/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function BookingConfirmationPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { id: hostelId } = params;

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const reference = searchParams.get('reference');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (loading || !currentUser || !hostelId || !reference) return;

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

    }, [router, hostelId, reference, currentUser, loading, toast]);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex items-center justify-center py-12 px-4 bg-gray-50/50">
                <div className="flex flex-col items-center justify-center text-center">
                    <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
                    <h1 className="text-2xl font-bold font-headline mb-2">Payment Confirmed. Saving Your Visit...</h1>
                    <p className="text-muted-foreground max-w-sm">
                        Your payment was successful. Please wait while we create your visit record and find an agent.
                    </p>
                </div>
            </main>
        </div>
    );
}
