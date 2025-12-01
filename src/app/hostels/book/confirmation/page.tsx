// src/app/hostels/book/confirmation/page.tsx
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Loader2 } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { notifyBookingConfirmed, notifyAgentNewBooking } from "@/lib/notification-service-onesignal";
import { onAuthStateChanged, User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

function ConfirmationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const hostelId = searchParams.get('hostelId');
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const bookingType = searchParams.get('bookingType');
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
            
            // This is a secure hostel payment (has bookingType=secure OR trxref parameter)
            if ((bookingType === 'secure' || trxref) && hostelId && !visitTypeParam) {
                try {
                     const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                     if(!userDoc.exists()) throw new Error("Student user record not found.");

                    // Retrieve booking data from sessionStorage
                    const bookingDataStr = sessionStorage.getItem('pendingBookingData');
                    const bookingData = bookingDataStr ? JSON.parse(bookingDataStr) : {};
                    
                    // Clear the sessionStorage after retrieving
                    sessionStorage.removeItem('pendingBookingData');

                    const bookingRef = await addDoc(collection(db, 'bookings'), {
                        studentId: currentUser.uid,
                        studentDetails: {
                            fullName: bookingData.studentName || userDoc.data()?.fullName,
                            email: bookingData.email || currentUser.email,
                            phoneNumber: bookingData.phoneNumber || userDoc.data()?.phone,
                            indexNumber: bookingData.indexNumber || '',
                            ghanaCardNumber: bookingData.ghanaCardNumber || '',
                            program: bookingData.departmentName || '',
                            level: bookingData.level || '',
                            guardianEmail: bookingData.guardianEmail || '',
                        },
                        hostelId: hostelId,
                        roomTypeId: bookingData.roomTypeId || '',
                        roomId: bookingData.roomId || '',
                        roomNumber: bookingData.roomNumber || '',
                        paymentReference: trxref,
                        amountPaid: bookingData.roomPrice || 0,
                        bookingDate: serverTimestamp(),
                        status: 'confirmed',
                        invoiceGenerated: false,
                    });

                    // Increment occupancy for the secured room type so availability can be derived later
                    if (bookingData.roomTypeId) {
                        try {
                            const roomTypeRef = doc(db, 'hostels', hostelId, 'roomTypes', bookingData.roomTypeId);
                            await updateDoc(roomTypeRef, {
                                occupancy: increment(1),
                            });
                        } catch (e) {
                            console.error('Failed to update room type occupancy:', e);
                            // We deliberately do not block the booking flow if this fails
                        }

                    // Increment occupancy for the specific physical room if provided
                    if (bookingData.roomId) {
                        try {
                            const roomRef = doc(db, 'hostels', hostelId, 'rooms', bookingData.roomId);
                            await updateDoc(roomRef, {
                                currentOccupancy: increment(1),
                            });
                        } catch (e) {
                            console.error('Failed to update room occupancy:', e);
                        }
                    }
                    }

                    // Get hostel name for notification
                    const hostelDoc = await getDoc(doc(db, 'hostels', hostelId));
                    const hostelName = hostelDoc.exists() ? hostelDoc.data().name : 'your hostel';
                    const agentId = hostelDoc.exists() ? hostelDoc.data().agentId : null;

                    // Send notification to student
                    console.log('[Booking] Sending notification to student:', currentUser.uid);
                    try {
                        await notifyBookingConfirmed(
                            currentUser.uid,
                            hostelName,
                            bookingRef.id
                        );
                        console.log('[Booking] Student notification sent successfully');
                    } catch (err) {
                        console.error('[Booking] Failed to send student notification:', err);
                    }

                    // Send notification to agent
                    if (agentId) {
                        console.log('[Booking] Sending notification to agent:', agentId);
                        try {
                            await notifyAgentNewBooking(
                                agentId,
                                bookingData.studentName || currentUser.displayName || 'A student',
                                hostelName
                            );
                            console.log('[Booking] Agent notification sent successfully');
                        } catch (err) {
                            console.error('[Booking] Failed to send agent notification:', err);
                        }
                    }

                    toast({
                        title: "Room Secured!",
                        description: "Your payment was successful. Redirecting to your invoice...",
                    });
                     router.push(`/hostels/book/success/${bookingRef.id}`);

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
                    // Fetch student details for the visit record
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    const userData = userDoc.exists() ? userDoc.data() : {};
                    
                    const visitRef = await addDoc(collection(db, 'visits'), {
                        studentId: currentUser.uid,
                        studentDetails: {
                            fullName: userData.fullName || '',
                            email: userData.email || currentUser.email || '',
                            phoneNumber: userData.phoneNumber || userData.phone || '',
                        },
                        hostelId: hostelId,
                        agentId: null,
                        status: visitTypeParam === 'self' ? 'accepted' : 'scheduling',
                        paymentReference: reference, // This is the professional reference from Paystack
                        createdAt: serverTimestamp(),
                        visitDate: visitDate || new Date().toISOString(),
                        visitTime: visitTime || new Date().toLocaleTimeString(),
                        visitType: visitTypeParam as 'agent' | 'self',
                        studentCompleted: false,
                        amountPaid: visitTypeParam === 'agent' ? 1 : 15, // Store the amount paid
                        bookingType: 'visit', // Mark as visit booking
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

    }, [currentUser, loadingAuth, hasProcessed, router, hostelId, reference, trxref, bookingType, toast, visitDate, visitTime, visitTypeParam]);

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
