// src/app/hostels/book/confirmation/page.tsx
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2, AlertCircle, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { notifyBookingConfirmed, notifyManagerNewBooking, notifyAdminNewBooking } from "@/lib/notification-service-onesignal";
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { verifyAndProcessBooking } from '@/app/actions/paystack';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function ConfirmationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const hostelId = searchParams.get('hostelId');
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const bookingType = searchParams.get('bookingType');
    const visitTypeParam = searchParams.get('visitType') || searchParams.get('visit_type') || 'self';

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [hasProcessed, setHasProcessed] = useState(false);
    const [isProcessing, setIsProcessing] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            if (!loadingAuth) {
                toast({ title: "Authentication Error", description: "You must be logged in to confirm a booking.", variant: 'destructive' });
                router.push('/login');
            }
            return;
        }

        const handleConfirmation = async () => {
            setHasProcessed(true);
            setIsProcessing(true);
            setError(null);

            if (!hostelId || (!trxref && !reference)) {
                const msg = "Missing required booking details in confirmation link.";
                setError(msg);
                setIsProcessing(false);
                toast({ title: "Invalid Confirmation Link", description: msg, variant: "destructive" });
                return;
            }

            try {
                // This is a secure hostel payment (has bookingType=secure OR trxref parameter)
                if (bookingType === 'secure' || trxref) {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (!userDoc.exists()) throw new Error("Student user record not found.");

                    // Retrieve booking data from sessionStorage
                    const bookingDataStr = sessionStorage.getItem('pendingBookingData');
                    const bookingData = bookingDataStr ? JSON.parse(bookingDataStr) : {};

                    // Clear the sessionStorage after retrieving
                    sessionStorage.removeItem('pendingBookingData');

                    // Use Server Action to securely verify transaction, create booking, and update manager wallet
                    const result = await verifyAndProcessBooking(
                        trxref || reference || '',
                        bookingData,
                        hostelId,
                        currentUser.uid
                    );

                    if (!result.success) {
                        throw new Error(result.message || "Payment verification failed.");
                    }

                    const bookingId = result.bookingId;

                    // Get hostel name for notification
                    const hostelDoc = await getDoc(doc(db, 'hostels', hostelId));
                    const hostelData = hostelDoc.exists() ? hostelDoc.data() as any : null;
                    const hostelName = hostelData?.name || 'your hostel';
                    const managerId = hostelData?.managerId as string | undefined;

                    // Send notification to student
                    console.log('[Booking] Sending notification to student:', currentUser.uid);
                    try {
                        await notifyBookingConfirmed(
                            currentUser.uid,
                            hostelName,
                            bookingId
                        );
                        console.log('[Booking] Student notification sent successfully');
                    } catch (err) {
                        console.error('[Booking] Failed to send student notification:', err);
                    }

                    // Send notification to manager if hostel has one
                    if (managerId) {
                        console.log('[Booking] Sending notification to manager:', managerId);
                        try {
                            await notifyManagerNewBooking(
                                managerId,
                                hostelName,
                                bookingId
                            );
                            console.log('[Booking] Manager notification sent successfully');
                        } catch (err) {
                            console.error('[Booking] Failed to send manager notification:', err);
                        }
                    }

                    // Send notification to all admins about the new booking
                    try {
                        const adminsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
                        await Promise.all(
                            adminsSnap.docs.map((adminDoc) =>
                                notifyAdminNewBooking(
                                    adminDoc.id,
                                    hostelName,
                                    bookingId
                                ).catch((err) => {
                                    console.error('[Booking] Failed to send admin booking notification:', err);
                                })
                            )
                        );
                    } catch (err) {
                        console.error('[Booking] Failed to query admins for booking notification:', err);
                    }

                    toast({
                        title: "Room Secured!",
                        description: "Your payment was successful. Redirecting to your invoice...",
                    });
                    router.push(`/hostels/book/success/${bookingId}`);
                    return;
                }

                // Fallback if no valid payment pattern matched
                throw new Error("Unable to identify payment type. Please verify transaction reference.");
            } catch (err: any) {
                console.error("Error confirming booking:", err);
                const errorMessage = err?.message || "Could not finalize your booking. Please contact support.";
                setError(errorMessage);
                toast({ title: "Booking Confirmation Issue", description: errorMessage, variant: 'destructive' });
            } finally {
                setIsProcessing(false);
            }
        };

        handleConfirmation();

    }, [currentUser, loadingAuth, hasProcessed, router, hostelId, reference, trxref, bookingType, visitTypeParam, toast]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 bg-white rounded-3xl border border-border/80 shadow-lg animate-in fade-in zoom-in-95 duration-300">
                <div className="h-16 w-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-inner">
                    <AlertCircle className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold font-headline text-slate-900 mb-2">Booking Confirmation Issue</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    {error}
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                    <Button
                        onClick={() => {
                            setError(null);
                            setIsProcessing(true);
                            setHasProcessed(false);
                        }}
                        className="flex-1 rounded-xl h-11 text-xs font-semibold gap-1.5"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try Again
                    </Button>

                    {hostelId ? (
                        <Button
                            asChild
                            variant="outline"
                            className="flex-1 rounded-xl h-11 text-xs font-semibold gap-1.5"
                        >
                            <Link href={`/hostels/${hostelId}`}>
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Return to Hostel
                            </Link>
                        </Button>
                    ) : (
                        <Button
                            asChild
                            variant="outline"
                            className="flex-1 rounded-xl h-11 text-xs font-semibold gap-1.5"
                        >
                            <Link href="/my-bookings">
                                <Home className="h-3.5 w-3.5" />
                                My Bookings
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
            <h1 className="text-2xl font-bold font-headline mb-2">Finalizing Your Request...</h1>
            <p className="text-muted-foreground text-sm max-w-sm">
                Your payment was processed. Please wait while we verify your transaction and prepare your booking records.
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
